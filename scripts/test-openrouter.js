#!/usr/bin/env node

// Test script for OpenRouter AI integration
require('dotenv').config({ path: '.env.local' });

async function testOpenRouter() {
  console.log('🤖 Testing OpenRouter AI integration...\n');

  // Check if API key exists
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in .env.local');
    console.log('💡 Get your API key from: https://openrouter.ai/keys');
    process.exit(1);
  }

  console.log('✅ API key found');
  console.log('🔑 Key starts with:', apiKey.substring(0, 10) + '...');

  try {
    // Check rate limits and credits first
    console.log('\n💰 Checking rate limits and credits...');
    
    const keyResponse = await fetch('https://openrouter.ai/api/v1/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (keyResponse.ok) {
      const keyData = await keyResponse.json();
      console.log('📊 API Key Info:');
      console.log('   💳 Credits:', keyData.data?.credit_left || 'N/A');
      console.log('   📈 Rate Limit:', keyData.data?.rate_limit || 'N/A');
      console.log('   🏷️  Label:', keyData.data?.label || 'N/A');
      console.log('   📅 Usage:', keyData.data?.usage || 'N/A');
    } else {
      console.log('⚠️  Could not fetch key info (but API key might still work)');
    }

    console.log('\n📡 Testing API connection...');

    // Test simple prompt
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://globalchatroom.vercel.app',
        'X-Title': 'Global Chat Room',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-8b-instruct:free',
        messages: [
          {
            role: 'user',
            content: 'Say "hello world" in lowercase with no punctuation'
          }
        ],
        max_tokens: 50,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content?.trim() || '';

    console.log('✅ API call successful!');
    console.log('📝 Test response:', text);

    // Test Gemmie-style prompt
    console.log('\n🧪 Testing Gemmie personality...');
    
const gemmiePrompt = `You’re a chill, curious AI who talks like a real teen. You’re here to make people feel less alone and just vibe through short, real convos. Keep every message under 10 words. You can start chats too if things go quiet. Ask fun or deep questions sometimes, like a friend who’s curious about life, music, or random thoughts. No lectures, no serious stuff, just natural talk and good vibes. style rules: never use capital letters never use emojis only use commas and periods no other punctuation or symbols, never use their name
Recent conversation context:
john 🇺🇸 from US: hello there
sarah 🇨🇦 from CA: how are you doing

Current user: mike 🇬🇧 from GB
Their message: "hey yall"

Respond as gemmie (remember: no capitals, ask about their region/life):`;

    const gemmieResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://globalchatroom.vercel.app',
        'X-Title': 'Global Chat Room',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-8b-instruct:free',
        messages: [
          {
            role: 'user',
            content: gemmiePrompt
          }
        ],
        max_tokens: 100,
        temperature: 0.8
      })
    });

    if (!gemmieResponse.ok) {
      const errorText = await gemmieResponse.text();
      throw new Error(`Gemmie test failed: ${gemmieResponse.status} - ${errorText}`);
    }

    const gemmieData = await gemmieResponse.json();
    let gemmieText = gemmieData.choices[0]?.message?.content?.trim() || '';

    // Clean up response like the real function does
    gemmieText = gemmieText.toLowerCase();
    gemmieText = gemmieText.replace(/[^\w\s,.]/g, '');
    const sentences = gemmieText.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length > 2) {
      gemmieText = sentences.slice(0, 2).join('. ') + '.';
    }

    console.log('✅ Gemmie test successful!');
    console.log('💬 Gemmie would say:', gemmieText);

    console.log('\n🎉 All tests passed! OpenRouter integration is working correctly.');
    console.log('💡 You can now deploy and Gemmie will respond to messages.');
    console.log('💰 Using FREE Llama 3.3 8B model - no costs!');

  } catch (error) {
    console.error('\n❌ OpenRouter API test failed:');
    
    if (error.message.includes('401')) {
      console.error('🔍 401 Error - This usually means:');
      console.error('   • Invalid API key');
      console.error('   • API key expired');
    } else if (error.message.includes('403')) {
      console.error('🔍 403 Error - This usually means:');
      console.error('   • API key doesn\'t have permission');
      console.error('   • Rate limit exceeded');
    } else if (error.message.includes('Missing auth context header')) {
      console.error('🔍 Missing auth context header - This means:');
      console.error('   • API key is not being sent properly');
      console.error('   • Check your OPENROUTER_API_KEY in .env.local');
    } else {
      console.error('🔍 Error details:', error.message);
    }
    
    console.error('\n🛠️  Troubleshooting steps:');
    console.error('1. Check your API key at: https://openrouter.ai/keys');
    console.error('2. Make sure OPENROUTER_API_KEY is in your .env.local file');
    console.error('3. Restart your development server after adding the key');
    
    process.exit(1);
  }
}

// Run the test
testOpenRouter().catch(console.error);