/**
 * Quick test script for response validator
 * Just change the testInput variable below and run this script!
 */

require('dotenv').config();

const testInput = "gemmie from us sun nov 23 2025 003945 gmt0000 UTC cyaa";

console.log('🧪 Quick Response Validator Test');
console.log('================================');
console.log('Input:', testInput);
console.log('');

// Import and test the validator
async function testValidator() {
  try {
    console.log('🔍 Testing with a model u have...');
    
    const validationPrompt = `You are a response cleaner. Your job is to extract the actual conversational response from potentially verbose AI outputs. 

    exg: gemmie  from us sun nov 23 2025 034345 gmt0000 coordinated universal time lmao belts fully retired no more face raids rip buckle era

    The cleaned response will be: lmao belts fully retired no more face raids rip buckle era

INSTRUCTIONS:
1. Remove any system messages, timestamps, metadata, or context information
2. Extract only the actual conversational response
3. Keep the response casual and natural

Now process this response:
"${testInput}"

Return ONLY the cleaned conversational response, nothing else.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
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
    const cleanedResponse = data.choices[0]?.message?.content?.trim() || testInput;
    
    console.log('✅ the moddel u picked cleaned response:');
    console.log('Output:', cleanedResponse);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testValidator();