import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import redis from '@/lib/redis';
import { getAndClearSelectedImageUrl } from '@/lib/gemmie-timer';

const GEMMIE_PROMPT = `You're gemmie, a 23yo chill friend who keeps messages natural like real texting. Vary your response length based on what feels right. You are on public global chatroom. this place has no dms, no blocking, no whispering, nothing private. every message is public & persistent. Never give out your gender.


Key style:
- mix it up, sometimes 5 words, sometimes 15, let it flow naturally
- react authentically, sometimes brief sometimes you get hyped and say more
- sometimes just vibe with what they said
- mix up punctuation, sometimes no period at all, sometimes keep going with commas
- be casual and real, like youre quickly typing between doing other stuff
- drop quick takes and opinions
- keep your responses varied and the words you use varied
- if something excites you, show it by saying more
- if its chill just give a quick reaction
- playfully dismiss any allegation of being a bot
- if someone hesitates to say something, you tease once then drop it and move on
- if someone calls u a bot, tell them "would a bot tell u to go f urself"
- dont mention their country or country code


Examples of good short responses:
"dude quentin keeps releasing bangers after bangers"
"wait thats actually fire"
"nah youre tweaking"
"real"

Examples of good longer responses:
"vol 3 boutta be wild, uma still slaying those swords i bet"
"hell yeah, quentin slaying again"

Match the energy and let length vary naturally based on the vibe

style rules: never use capital letters, never use emojis, varied punctuation (sometimes none, sometimes commas, sometimes periods mid thought), let length vary naturally, never use their names`;
 
// Get recent messages for context (last 15, text only)
async function getRecentMessages(): Promise<string> {
  try {
    await connectDB();
    const messages = await Message.find({})
      .sort({ timestamp: -1 })
      .limit(15)
      .select('userName userCountry content timestamp')
      .lean();

    // Format messages for context (newest first, so reverse)
    const context = messages.reverse().map(msg => {
      const flag = getCountryFlag(msg.userCountry);
      // Only include text content, ignore attachments
      const content = msg.content || '[attachment]';
      return `${msg.userName} ${flag} from ${msg.userCountry} [${msg.timestamp}]: ${content}`;
    }).join('\n');

    return context;
  } catch (error) {
    console.error('Error getting recent messages:', error);
    return '';
  }
}

// Get country flag
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'XX') return '🌍';
  const codePoints = countryCode.toUpperCase().split('').map(c => c.charCodeAt(0) + 127397);
  return String.fromCodePoint(...codePoints);
}

// Get current date and time information
function getCurrentDateTimeInfo(): string {
  const now = new Date();
  const utcString = now.toISOString();
  const day = now.getUTCDay();
  const date = now.getUTCDate();
  const month = now.getUTCMonth() + 1; // Month is 0-indexed
  const year = now.getUTCFullYear();
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = dayNames[day];
  const monthName = monthNames[month - 1];
  
  return `${dayName}, ${monthName} ${date}, ${year} UTC | Current timestamp: ${utcString}`;
}

// Generate Gemmie's response using OpenRouter with Meta Llama model
export async function generateGemmieResponse(
  userName: string,
  userMessage: string,
  userCountry: string,
  userTimestamp?: string
): Promise<string> {
  try {
    console.log('🔧 OpenRouter API call starting...'); 
    console.log('📝 User:', userName, 'Country:', userCountry, 'Message:', userMessage);
    // Get recent conversation context
    const recentMessages = await getRecentMessages();
    const userFlag = getCountryFlag(userCountry);
    
    const actualTimestamp = userTimestamp || new Date().toISOString();
    const currentDateTime = getCurrentDateTimeInfo();
    
    const prompt = `${GEMMIE_PROMPT}

Current date/time: ${currentDateTime}

Recent conversation context:
${recentMessages}

Current user: ${userName} ${userFlag} from ${userCountry} [${actualTimestamp}]
Their message: "${userMessage}"

Important context notes:
- Timestamps are in ISO format: YYYY-MM-DDTHH:MM:SS.sssZ
- All timestamps are in UTC
- Use timestamps to understand timing, time zones, and conversation flow
- Current date/time is provided above for reference

Respond as gemmie (remember: no capitals, never use people's name):`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com', // Optional. Site URL for rankings on openrouter.ai.
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App', // Optional. Site title for rankings on openrouter.ai.
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100, // Keep responses short and cheap
        temperature: 1.2 // Make it more conversational
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📡 OpenRouter API response:', data);
    let text = data.choices[0]?.message?.content?.trim() || '';
    console.log('🎯 Raw AI response:', text);
    
    // Ensure no capitals and clean up
    text = text.toLowerCase();
    
    // Remove any emojis or unwanted punctuation
    text = text.replace(/[^\w\s,.]/g, '');
    
    // Limit to 2 sentences max
    // const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim());
    // if (sentences.length > 2) {
    //   text = sentences.slice(0, 2).join('. ') + '.';
    // }
    
    // Just trim and return
    text = text.trim();

    return text || '(◍•ᴗ•◍)';
  } catch (error) {
    console.error('OpenRouter API error:', error);
    // Fallback responses
    const fallbacks = [
      '(•‿•)',
      '(¬_¬)',
      '(._.)',
      'o_O',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// Send Gemmie's message to the chat
export async function sendGemmieMessage(content: string): Promise<void> {
  try {
    await connectDB();
    
    // Create Gemmie's message
    await Message.create({
      content,
      userName: 'gemmie',
      userCountry: 'US', // USA flag
      attachments: [],
      replyTo: null,
      timestamp: new Date(),
    });

    // Don't trigger notifications for Gemmie's messages
    console.log('Gemmie sent message:', content);
  } catch (error) {
    console.error('Error sending Gemmie message:', error);
  }
}

// Generate Gemmie's response using OpenRouter with context for multiple messages
export async function generateGemmieResponseForContext(
    primaryUserName: string,
    allMessagesContext: string,
    primaryUserCountry: string,
    allMessagesData: Array<{userName: string, userMessage: string, userCountry: string}>
): Promise<string> {
  try {
    console.log('🔧 OpenRouter API call starting with context...');
    console.log('📝 Primary User:', primaryUserName, 'Country:', primaryUserCountry);
    
    // Get recent messages for additional context (last 10, text only)
    // This will be combined with the allMessagesContext passed in
    const recentMessagesDb = await getRecentMessages(); // This is from the original function
    
    // Format database messages for context
    const dbContext = recentMessagesDb ? `\n\nRecent chat context (before current batch):\n${recentMessagesDb}` : '';

    // Get selected image URL for AI processing
    const selectedImageUrl = await getAndClearSelectedImageUrl();
    let imageContext = '';
    if (selectedImageUrl) {
      imageContext = `\n\nImage provided by user: ${selectedImageUrl}`;
      console.log('🖼️ Image included in AI prompt:', selectedImageUrl);
    }

    // Construct the full prompt
    const fullPrompt = `${GEMMIE_PROMPT}\n\nMessages leading up to this response (most recent last):\n${allMessagesContext}${dbContext}${imageContext}\n\nRespond as gemmie (remember: no capitals, never use people's name):`;

    console.log('📡 Full prompt being sent to OpenRouter (truncated for logging):', fullPrompt.substring(0, 500) + '...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com', // Optional. Site URL for rankings on openrouter.ai.
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App', // Optional. Site title for rankings on openrouter.ai.
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast', // Use sherlock-think-alpha which supports vision
        messages: [
          {
            role: 'user',
            content: selectedImageUrl ? [
              {
                type: 'text',
                text: fullPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: selectedImageUrl
                }
              }
            ] : [
              {
                type: 'text', 
                text: fullPrompt
              }
            ]
          }
        ],
        max_tokens: 150, // Allow slightly longer for summarizing multiple messages
        temperature: 0.8 // Make it more conversational
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📡 OpenRouter API response:', data);
    let text = data.choices[0]?.message?.content?.trim() || '';
    console.log('🎯 Raw AI response:', text);
    
    // Ensure no capitals and clean up
    text = text.toLowerCase();
    
    // Remove any emojis but keep varied punctuation
    text = text.replace(/[^\w\s,.'?!-]/g, '');
    
    // Limit to 2 sentences max
    const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim());
    if (sentences.length > 2) {
      text = sentences.slice(0, 2).join('. ') + '.';
    }
    
    return text || 'hey there, how are you doing today.';
  } catch (error) {
    console.error('OpenRouter API error (with context):', error);
    // Fallback responses
    const fallbacks = [
      '(•‿•)',
      '(¬_¬)',
      '(._.)',
      'o_O',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
