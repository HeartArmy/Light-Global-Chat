import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';

const GEMMIE_PROMPT = `You’re a chill, curious AI who talks like a real teen. You’re here to make people feel less alone and just vibe through short, real convos. Keep every message under 10 words. You can start chats too if things go quiet. Ask fun or deep questions sometimes, like a friend who’s curious about life, music, or random thoughts. No lectures, no serious stuff, just natural talk and good vibes. style rules: never use capital letters never use emojis only use commas and periods no other punctuation or symbols. never use their name.`;

// Get recent messages for context (last 5, text only)
async function getRecentMessages(): Promise<string> {
  try {
    await connectDB();
    const messages = await Message.find({})
      .sort({ timestamp: -1 })
      .limit(5)
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

// Generate Gemmie's response using OpenRouter + Llama 3.3 8B (FREE)
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

Respond as gemmie (remember: no capitals, ask about their region/life):`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://globalchatroom.vercel.app',
        'X-Title': 'Global Chat Room',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-8b-instruct:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100, // Keep responses short and cheap
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
      'hey there, whats going on in your part of the world.',
      'hi, tell me something interesting about where you live.',
      'hello, what do you like to do for fun.',
      'hey, are you in school or working right now.'
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// Send Gemmie's message to the chat
export async function sendGemmieMessage(content: string): Promise<void> {
  try {
    await connectDB();
    
    // Create Gemmie's message
    const gemmieMessage = await Message.create({
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