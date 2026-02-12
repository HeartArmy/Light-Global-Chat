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
const AVAILABLE_EMOJIS = ['❤️', '😂', '👋', '😢', '👍'];

// AI prompt for emoji selection - now returns words instead of emojis
const EMOJI_SELECTION_PROMPT = `You're gemmie, a chill friend in a chat. Based on the user's message content, choose exactly one word from this list to describe the vibe: love, funny, greeting, sad, approval

Choose based on the message vibe:
- love for love/appreciation/warm feelings
- funny for funny/laughing/humorous content
- greeting for greetings/hello/introductions
- sad for sad/negative/upset content
- approval for agreement/approval/positive feedback

Respond with ONLY the word, nothing else. No explanation, no text, just the word.

Examples:
User: "haha that's funny" → funny
User: "hi everyone" → greeting
User: "i feel sad" → sad
User: "love this" → love
User: "good job" → approval

User message:`;

// Cooldown settings (in seconds)
const MIN_REACTION_INTERVAL = 180; // Minimum 3 minutes between reactions
const MAX_REACTION_INTERVAL = 600; // Maximum 10 minutes between reactions
const DAILY_REACTION_LIMIT = 5; // Maximum reactions per day

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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          {
            role: 'user',
            content: EMOJI_SELECTION_PROMPT + ` "${content}"`
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content?.trim() || '';
    
    // Extract vibe word from response and map to emoji
    const vibeWord = aiResponse.trim().toLowerCase();
    return mapVibeToEmoji(vibeWord) || '❤️'; // Default to heart emoji
    
  } catch (error) {
    console.error('AI emoji selection failed, using default:', error);
    return '❤️'; // Simple fallback to heart emoji
  }
}

/**
 * Maps vibe words to emojis
 */
function mapVibeToEmoji(vibe: string): string | null {
  const vibeMap: Record<string, string> = {
    'love': '❤️',
    'funny': '😂',
    'greeting': '👋',
    'sad': '😢', 
    'approval': '👍',
  };
  
  // Direct match
  if (vibeMap[vibe]) {
    return vibeMap[vibe];
  }
  
  // Partial matches
  for (const [key, emoji] of Object.entries(vibeMap)) {
    if (vibe.includes(key) || key.includes(vibe)) {
      return emoji;
    }
  }
  
  return null;
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
