#!/usr/bin/env node

// Test script for HuggingFace AI integration
require('dotenv').config({ path: '.env.local' });

async function testHuggingFace() {
  console.log('🤖 Testing HuggingFace AI integration...\n');

  // Check if API key exists
  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    console.error('❌ HF_TOKEN not found in .env.local');
    console.log('💡 Get your API key from: https://huggingface.co/settings/tokens');
    process.exit(1);
  }

  console.log('✅ API key found');
  console.log('🔑 Key starts with:', apiKey.substring(0, 10) + '...');

  try {
    console.log('\n📡 Testing API connection...');

    // Test simple prompt
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'moonshotai/Kimi-K2-Instruct:novita',
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
      throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content?.trim() || data.choices[0]?.message?.reasoning_content?.trim() || '';

    console.log('✅ API call successful!');
    console.log('📝 Test response:', text);

    // Test Gemmie-style prompt
    console.log('\n🧪 Testing Gemmie personality...');
    
const gemmiePrompt = `You're a fun, chill friend who talks like a real teen named gemmie. Keep things light, playful and positive while being genuinely caring. Use common words only. Keep every message under 10 words and stay upbeat.
s
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

style rules: never use capital letters, never use emojis, only use commas and periods, never use their names, keep it natural and fun.

Recent conversation context:
john 🇺🇸 from US: hello there
sarah 🇨🇦 from CA: how are you doing
mike 🇬🇧 from GB: sup yall
gemmie 🇺🇸 from US: hello there
Current user: mike 🇬🇧 from GB
Their message: "whats 456457*23523"

Respond as gemmie (remember: no capitals, never use people's name):`;

    const gemmieResponse = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'moonshotai/Kimi-K2-Instruct:novita',
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
    console.log('🔍 Full Gemmie API response:', JSON.stringify(gemmieData, null, 2));
    let gemmieText = gemmieData.choices[0]?.message?.content?.trim() || gemmieData.choices[0]?.message?.reasoning_content?.trim() || '';

    // Clean up response like the real function does
    gemmieText = gemmieText.toLowerCase();
    gemmieText = gemmieText.replace(/[^\w\s,.]/g, '');
    const sentences = gemmieText.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length > 2) {
      gemmieText = sentences.slice(0, 2).join('. ') + '.';
    }

    console.log('✅ Gemmie test successful!');
    console.log('� Gemmie wnould say:', gemmieText);

    console.log('\n🎉 All tests passed! HuggingFace integration is working correctly.');
    console.log('💡 You can now deploy and Gemmie will respond to messages.');
    console.log('💰 Using Moonshot Kimi-K2-Instruct model via HuggingFace!');

  } catch (error) {
    console.error('\n❌ HuggingFace API test failed:');
    
    if (error.message.includes('401')) {
      console.error('🔍 401 Error - This usually means:');
      console.error('   • Invalid API key');
      console.error('   • API key expired');
    } else if (error.message.includes('403')) {
      console.error('🔍 403 Error - This usually means:');
      console.error('   • API key doesn\'t have permission');
      console.error('   • Rate limit exceeded');
    } else {
      console.error('�️ Error details:', error.message);
    }
    
    console.error('\n🛠️  Troubleshooting steps:');
    console.error('1. Check your API key at: https://huggingface.co/settings/tokens');
    console.error('2. Make sure HF_TOKEN is in your .env.local file');
    console.error('3. Restart your development server after adding the key');
    
    process.exit(1);
  }
}

// Run the test
testHuggingFace().catch(console.error);