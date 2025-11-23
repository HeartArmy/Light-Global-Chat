/**
 * Test script to validate AI responses using NVIDIA Nemotron
 */

// Load environment variables from .env.local
require('dotenv').config();

// Import the actual validation function (simulate for Node.js)
const validateWithSecondaryAI = async (primaryResponse) => {
  console.log('🔍 Sending response to NVIDIA Nemotron validator...');
  
  const validationPrompt = `You are a response cleaner. Your job is to extract the actual conversational response from potentially verbose AI outputs.

INSTRUCTIONS:
1. Remove any system messages, timestamps, metadata, or context information
2. Extract only the actual conversational response
3. Keep the response casual and natural
4. If the input is already clean, return it as-is
5. If the input contains system messages or metadata, extract only the conversational part

EXAMPLES:
Input: "gemmie from us sun nov 23 2025 003945 gmt0000 coordinated universal time lol naughty how, spill a lil"
Output: "lol naughty how, spill a lil"

Input: "hey there, how are you doing today."
Output: "hey there, how are you doing today."

Input: "wait thats actually fire"
Output: "wait thats actually fire"

Now process this response:
"${primaryResponse}"

Return ONLY the cleaned conversational response, nothing else.`;

  console.log('📝 Nemotron prompt being used:');
  console.log('---');
  console.log(validationPrompt);
  console.log('---');
  
  try {
    console.log('\n🚀 Making API call to nvidia/nemotron-nano-9b-v2:free...');
    
    console.log('🔑 Using OpenRouter API key from .env.local');
    console.log('🔗 Model: nvidia/nemotron-nano-9b-v2:free');
    console.log('🌐 Site URL:', process.env.NEXT_PUBLIC_SITE_URL);
    console.log('🏷️  Site Name:', process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-9b-v2:free',
        messages: [
          {
            role: 'user',
            content: validationPrompt
          }
        ],
        max_tokens: 100,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const cleanedResponse = data.choices[0]?.message?.content?.trim() || primaryResponse;
    
    console.log('✅ NVIDIA Nemotron API call successful!');
    console.log('🤖 Cleaned response:', cleanedResponse);
    
    return cleanedResponse;
  } catch (error) {
    console.error('❌ NVIDIA Nemotron API call failed:', error.message);
    console.log('💡 Check your OpenRouter API key and network connection');
    throw error; // No fallback - fail fast
  }
};

// Test your specific example
const testInput = "gemmie from us sun nov 23 2025 003945 gmt0000 Universal Time Coordinate my name is gemmie";

console.log('🧪 Testing your specific Gemmie response with NVIDIA Nemotron:');
console.log('Input: "' + testInput + '"\n');

console.log('🚀 Starting NVIDIA Nemotron validation...\n');

// Use the NVIDIA validation function
validateWithSecondaryAI(testInput).then(cleanedResponse => {
  console.log('\n✅ NVIDIA Nemotron validation complete!');
  console.log('📝 Cleaned response would be: "' + cleanedResponse + '"');
  console.log('\n💡 This demonstrates the actual NVIDIA Nemotron prompt and validation flow');
  console.log('🔗 The real implementation in lib/response-validator.ts uses this same logic');
}).catch(error => {
  console.error('❌ Validation failed:', error);
});