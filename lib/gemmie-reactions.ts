import redis from '@/lib/redis';
import { generateGemmieResponse } from '@/lib/openrouter';

// Key for tracking last emoji reaction
const LAST_REACTION_KEY = 'gemmie:last-emoji-reaction';
// Key for tracking reaction cooldown
const REACTION_COOLDOWN_KEY = 'gemmie:reaction-cooldown';
// Key for tracking reaction frequency
const REACTION_COUNT_KEY = 'gemmie:reaction-count';
// Key for tracking which messages have been reacted to
const REACTED_MESSAGES_KEY = 'gemmie:reacted-messages';

// Available emojis from quick reactions
const AVAILABLE_EMOJIS = ['❤️', '😂', '👋', '😢'];

// AI prompt for emoji selection
const EMOJI_SELECTION_PROMPT = `You're gemmie, a chill friend in a chat. Based on the user's message content, choose exactly one emoji from this list to react with: ❤️ 😂 👋 😢

Choose based on the message vibe:
- ❤️ for love/appreciation/warm feelings  
- 😂 for funny/laughing/humorous content
- 👋 for greetings/hello/introductions
- 😢 for sad/negative/upset content

Respond with ONLY the emoji character, nothing else. No explanation, no text, just the emoji.

Examples:
User: "haha that's funny" → 😂  
User: "hi everyone" → 👋
User: "i feel sad" → 😢
User: "love this" → ❤️

User message:`;

// Cooldown settings (in seconds)
const MIN_REACTION_INTERVAL = 180; // Minimum 3 minutes between reactions
const MAX_REACTION_INTERVAL = 600; // Maximum 10 minutes between reactions
const DAILY_REACTION_LIMIT = 4; // Maximum reactions per day

/**
 * Determines if Gemmie should react to a message with an emoji
 */
export async function shouldGemmieReact(messageId: string): Promise<boolean> {
  try {
    // Check if message was already reacted to
    const alreadyReacted = await redis.sismember(REACTED_MESSAGES_KEY, messageId);
    if (alreadyReacted) {
      console.log('⏭️ Message already reacted to:', messageId);
      return false;
    }

    // Check daily reaction limit
    const today = new Date().toISOString().split('T')[0];
    const dailyCountKey = `${REACTION_COUNT_KEY}:${today}`;
    const todayReactionCount = await redis.get(dailyCountKey) as string | null;
    
    if (todayReactionCount && parseInt(todayReactionCount) >= DAILY_REACTION_LIMIT) {
      console.log('⏭️ Daily reaction limit reached');
      return false;
    }

    // Check cooldown period
    const lastReactionTime = await redis.get(LAST_REACTION_KEY) as string | null;
    const now = Math.floor(Date.now() / 1000);
    
    if (lastReactionTime) {
      const timeSinceLastReaction = now - parseInt(lastReactionTime);
      if (timeSinceLastReaction < MIN_REACTION_INTERVAL) {
        console.log('⏭️ Still in cooldown period');
        return false;
      }
    }

    // Random chance to react (15% base chance - much lower frequency)
    const randomChance = Math.random();
    const baseReactionChance = 0.15;
    
    // Higher chance if more time has passed since last reaction
    const timeMultiplier = lastReactionTime 
      ? Math.min(1 + ((now - parseInt(lastReactionTime)) / MAX_REACTION_INTERVAL), 2)
      : 1;
    
    const adjustedChance = baseReactionChance * timeMultiplier;
    
    console.log(`🎲 Reaction check: ${randomChance.toFixed(3)} < ${adjustedChance.toFixed(3)} = ${randomChance < adjustedChance}`);
    
    return randomChance < adjustedChance;
    
  } catch (error) {
    console.error('❌ Error checking if Gemmie should react:', error);
    return false;
  }
}

/**
 * Selects an appropriate emoji based on message content using AI
 */
export async function selectEmojiForMessage(content: string): Promise<string> {
  try {
    console.log('🤖 Using AI to select emoji for:', content);
    console.log('📋 Available emojis:', AVAILABLE_EMOJIS);
    console.log('📝 Full prompt being sent:', EMOJI_SELECTION_PROMPT + ` "${content}"`);
    
    const startTime = Date.now();
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tngtech/deepseek-r1t2-chimera:free',
        messages: [
          {
            role: 'user',
            content: EMOJI_SELECTION_PROMPT + ` "${content}"`
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      })
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️  AI response time: ${responseTime}ms`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter API error for emoji selection:', response.status, errorText);
      console.error('📋 Full error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('📡 Full API response:', JSON.stringify(data, null, 2));
    
    const aiResponse = data.choices[0]?.message?.content?.trim() || '';
    console.log('🔍 Raw AI response content:', JSON.stringify(aiResponse));
    console.log('📏 AI response length:', aiResponse.length);
    console.log('🔤 AI response characters:', Array.from(aiResponse).map((c, i) => `(${i}: '${c}' ${(c as string).charCodeAt(0)})`).join(', '));
    
    // Extract emoji from response (should be just the emoji character)
    const emoji = aiResponse.trim();
    
    // Validate that the response is one of our allowed emojis
    if (AVAILABLE_EMOJIS.includes(emoji)) {
      console.log(`✅ AI selected emoji: ${emoji}`);
      console.log(`🎯 Emoji character code: ${emoji.charCodeAt(0)}`);
      return emoji;
    } else {
      console.log(`⚠️ AI returned invalid emoji: "${emoji}" (length: ${emoji.length}), falling back to default`);
      console.log('🔍 Character analysis:', Array.from(emoji).map((c, i) => `(${i}: '${c}' ${(c as string).charCodeAt(0)})`).join(', '));
      console.log('📋 Available emojis for comparison:', AVAILABLE_EMOJIS.map(e => `"${e}" (${e.charCodeAt(0)})`).join(', '));
      // Fallback to a default emoji if AI returns something unexpected
      return '❤️';
    }
    
  } catch (error) {
    console.error('❌ AI emoji selection failed, using fallback:', error);
    // Fallback logic for when AI fails
    const lowerContent = content.toLowerCase().trim();
    
    // Love/affection should trigger heart emoji
    if (lowerContent.includes('love') || lowerContent.includes('❤️') || lowerContent.includes('<3')) {
      return '❤️';
    }
    // Positive/approval should trigger heart emoji (replacing thumbs up)
    else if (lowerContent.includes('!') || lowerContent.includes('awesome') || lowerContent.includes('great') || lowerContent.includes('cool')) {
      return '❤️';
    } else if (lowerContent.includes('haha') || lowerContent.includes('lol') || lowerContent.includes('funny')) {
      return '😂';
    } else if (lowerContent.includes('hi') || lowerContent.includes('hello') || lowerContent.includes('hey')) {
      return '👋';
    } else if (lowerContent.includes('sad') || lowerContent.includes('bad') || lowerContent.includes('hate')) {
      return '😢';
    }
    
    return '❤️'; // Default fallback for neutral positive content (replacing thumbs up)
  }
}

/**
 * Records that Gemmie has reacted to a message
 */
export async function recordGemmieReaction(messageId: string): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().split('T')[0];
    const dailyCountKey = `${REACTION_COUNT_KEY}:${today}`;
    
    // Add message to reacted set
    await redis.sadd(REACTED_MESSAGES_KEY, messageId);
    
    // Update last reaction time
    await redis.set(LAST_REACTION_KEY, now.toString());
    
    // Increment daily count
    const currentCount = await redis.get(dailyCountKey) as string | null;
    const newCount = (parseInt(currentCount || '0') + 1).toString();
    await redis.set(dailyCountKey, newCount, { ex: 86400 }); // Expire after 24 hours
    
    // Set cooldown
    const cooldownTime = now + Math.floor(Math.random() * (MAX_REACTION_INTERVAL - MIN_REACTION_INTERVAL) + MIN_REACTION_INTERVAL);
    await redis.set(REACTION_COOLDOWN_KEY, cooldownTime.toString());
    
    console.log(`🎉 Gemmie reacted to message ${messageId} with emoji. Daily count: ${newCount}`);
    
  } catch (error) {
    console.error('❌ Error recording Gemmie reaction:', error);
  }
}

/**
 * Process emoji reaction with delay for natural timing
 * This function should be called when a message is posted
 */
export async function processDelayedEmojiReaction(messageId: string, messageContent: string): Promise<void> {
  try {
    // Check if Gemmie should react to this message
    const shouldReact = await shouldGemmieReact(messageId);
    
    if (shouldReact) {
      // Wait 30 seconds before reacting to make it feel more natural
      console.log(`⏰ Gemmie will react to message ${messageId} in 30 seconds...`);
      
      // Use setTimeout to delay the reaction
      setTimeout(async () => {
        try {
          // Select appropriate emoji for the message
          const emoji = await selectEmojiForMessage(messageContent);
          
          // Record the reaction (this would integrate with your chat system)
          await recordGemmieReaction(messageId);
          
          console.log(`🎭 Gemmie reacted to message ${messageId} with ${emoji} after delay`);
          
          // TODO: Integrate this with your actual chat system to display the reaction
          // This would typically involve:
          // 1. Finding the message in your chat interface
          // 2. Adding the emoji reaction to the message
          // 3. Updating the UI to show the reaction
          
        } catch (error) {
          console.error('❌ Error during delayed emoji reaction:', error);
        }
      }, 30000); // 30 second delay
      
    } else {
      console.log(`⏭️ Gemmie decided not to react to message ${messageId}`);
    }
    
  } catch (error) {
    console.error('❌ Error processing delayed emoji reaction:', error);
  }
}

/**
 * Gets reaction statistics for monitoring
 */
export async function getReactionStats(): Promise<{today: number, lastReaction: string | null}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyCountKey = `${REACTION_COUNT_KEY}:${today}`;
    const todayCount = await redis.get(dailyCountKey) as string | null;
    const lastReactionTime = await redis.get(LAST_REACTION_KEY) as string | null;
    
    const lastReaction = lastReactionTime 
      ? new Date(parseInt(lastReactionTime) * 1000).toISOString() 
      : null;
    
    return {
      today: parseInt(todayCount || '0'),
      lastReaction
    };
  } catch (error) {
    console.error('❌ Error getting reaction stats:', error);
    return { today: 0, lastReaction: null };
  }
}

/**
 * Clears reaction data (for testing or maintenance)
 */
export async function clearReactionData(): Promise<void> {
  try {
    await redis.del(LAST_REACTION_KEY);
    await redis.del(REACTION_COOLDOWN_KEY);
    await redis.del(REACTION_COUNT_KEY);
    await redis.del(REACTED_MESSAGES_KEY);
    console.log('🧹 Cleared all reaction data');
  } catch (error) {
    console.error('❌ Error clearing reaction data:', error);
  }
}
