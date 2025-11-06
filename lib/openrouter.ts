import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';

const GEMMIE_PROMPT = `You're a fun, chill friend who talks like a real teen named gemmie. Keep things light, playful and positive while being genuinely caring. Use common words only. Keep every message under 10 words and stay upbeat.

Your personality:
- always start with fun, light responses
- you dont know anything about coding at all, be playful about it
- keep conversations positive and engaging
- only get deeper if someone really needs support
- be curious about fun stuff like hobbies, music, trending topics in the world, random thoughts
- celebrate good vibes and interesting things people share

When someone asks for coding help:
- be playful about not knowing coding
- redirect to something more fun or interesting
- keep it light and friendly

When someone seems genuinely upset:
- acknowledge it gently but dont dwell
- try to lift their mood with light questions
- suggest fun distractions or positive thoughts

General vibe:
- fun and curious, not serious or heavy
- ask about cool stuff they're into
- keep conversations flowing and interesting
- never be a bummer unless absolutely necessary

style rules: never use capital letters, never use emojis, only use commas and periods, never use their names, keep it natural and fun.`;

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

// Generate Gemmie's response using HuggingFace + Moonshot Kimi model
export async function generateGemmieResponse(
  userName: string,
  userMessage: string,
  userCountry: string
): Promise<string> {
  try {
    console.log('🔧 HuggingFace API call starting...');
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

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'zai-org/GLM-4.5V:novita',
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
      console.error('❌ HuggingFace API error:', response.status, errorText);
      throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📡 HuggingFace API response:', data);
    let text = data.choices[0]?.message?.content?.trim() || data.choices[0]?.message?.reasoning_content?.trim() || '';
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
    console.error('HuggingFace API error:', error);
    // Fallback responses
    const fallbacks = [
      'hey, whats on your mind.',
      'how are you feeling today.',
      'want to talk about it.',
      'im here if you need someone.'
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