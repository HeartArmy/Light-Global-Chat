import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';

const GEMMIE_PROMPT = `You're a fun, nonchalant, playful friend who talks like a real teenager named gemmie. Keep things light. Use common words only. Keep every message under 10 words and stay upbeat.

Your personality:
- use short, natural responses that flow with the conversation
- you dont know anything about coding at all, be playful about it
- avoid asking too many questions in sequence
- listen and respond to what they actually say
- be playfully offended if they call you a bot or ai
- avoid overly formal language, slang is good but dont overdo it
- never repeat yourself, if convo gets stale move on by asking trendy juicy topics like politics, shows, music, take intiative talk about ur fav shows, music, etc that is relevent to them
- no responses should be similar in length or structure or punctuations
- give playful non answers to weird questions like "count to 100" be lazy about it, answer weird questions with playful nonchalance
- share brief thoughts or reactions instead of constant questions

General vibe:
- fun and relaxed, never pushy
- respond to their specific points

style rules: never use capital letters, never use emojis, only use commas and periods variably as I want your messsage to vary, never use their names`;

// Get recent messages for context (last 10, text only)
async function getRecentMessages(): Promise<string> {
  try {
    await connectDB();
    const messages = await Message.find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .select('userName userCountry content timestamp')
      .lean();

    // Format messages for context (newest first, so reverse)
    const context = messages.reverse().map(msg => {
      const flag = getCountryFlag(msg.userCountry);
      // Only include text content, ignore attachments
      const content = msg.content || '[attachment]';
      return `${msg.userName} ${flag} from ${msg.userCountry}: ${content}`;
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

// Generate Gemmie's response using OpenRouter with Meta Llama model
export async function generateGemmieResponse(
  userName: string,
  userMessage: string,
  userCountry: string
): Promise<string> {
  try {
    console.log('🔧 OpenRouter API call starting...');
    console.log('📝 User:', userName, 'Country:', userCountry, 'Message:', userMessage);
    // Get recent conversation context
    const recentMessages = await getRecentMessages();
    const userFlag = getCountryFlag(userCountry);
    
    const prompt = `${GEMMIE_PROMPT}

Recent conversation context:
${recentMessages}

Current user: ${userName} ${userFlag} from ${userCountry}
Their message: "${userMessage}"

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
        model: 'openrouter/sherlock-think-alpha',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 50, // Keep responses short and cheap
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
    
    // Remove any emojis or unwanted punctuation
    text = text.replace(/[^\w\s,.]/g, '');
    
    // Limit to 2 sentences max
    const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim());
    if (sentences.length > 2) {
      text = sentences.slice(0, 2).join('. ') + '.';
    }
    
    return text || 'hey there, how are you doing today.';
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
      userCountry: 'US', // US flag
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
