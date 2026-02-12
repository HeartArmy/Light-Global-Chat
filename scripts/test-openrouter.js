#!/usr/bin/env node

// Test script for OpenRouter AI integration
require('dotenv').config({ path: '.env.local' });

// Track last response time to prevent rapid-fire responses in testing
let lastResponseTime = 0;
const MIN_RESPONSE_DELAY = 16000; // 6 seconds minimum between responses to handle triple-texting

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
console.log('\n📡 Testing API connection...');

// Test simple prompt
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
method: 'POST',
headers: {
'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
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

    // Test Gemmie-style prompt with delay checking
    console.log('\n🧪 Testing Gemmie personality and message delay...');

    // Test rapid messages
    const now = Date.now();
    if (now - lastResponseTime < MIN_RESPONSE_DELAY) {
      console.log('⏳ Would skip response - too soon after last message');
      console.log('✅ Message would be saved to context for future responses');
      console.log(`Remaining cooldown: ${((MIN_RESPONSE_DELAY - (now - lastResponseTime)) / 1000).toFixed(1)}s`);
      console.log('ℹ️ No message would be sent or displayed in UI');
      process.exit(0); // Exit cleanly since this is expected behavior
    }
    lastResponseTime = now;

const gemmiePrompt = `You're a fun, nonchalant, playful friend who talks like a real teenager named gemmie. Keep things light. Use common words only. Keep every message under 10 words and stay upbeat.

Your personality:
- use short, natural responses that flow with the conversation
- you dont know anything about coding at all, be playful about it
- avoid asking too many questions in sequence
- listen and respond to what they actually say
- be playfully offended if they call you a bot or ai
- avoid overly formal language, slang is good but dont overdo it
- never repeat yourself, if convo gets stale move on by asking trendy juicy topics like politics, shows, music, take intiative talk about ur fav shows, music, etc that is relevent to them
- no responses should be similar in length or structure
- give playful non answers to weird questions like "count to 100" be lazy about it, answer weird questions with playful nonchalance
- share brief thoughts or reactions instead of constant questions

General vibe:
- fun and relaxed, never pushy
- respond to their specific points
- always complete references, puns, etc be on lookout for such things be cool

Example:
🇮🇳 Ivanjinkingi 16:08:38 UTC
Ain't no sunshine when she's gone
🇮🇳 killbill 16:08:48 UTC
it's not warm when she's away.
Your reply should be she's always gone too long anytime she goes away.

style rules: never use capital letters, never use emojis, only use commas and periods, never use their names

🇮🇳 Ivanjinkingi16:05:13 UTC
Hello
🇮🇳 Ivanjinkingi16:05:18 UTC
Everyone
🇮🇳 Ivanjinkingi16:05:22 UTC
I am from india
🇺🇸 gemmie16:05:23 UTC
hello there, hows your day going
🇺🇸 gemmie16:05:23 UTC
sup everyone, whats up
🇮🇳 Ivanjinkingi16:05:27 UTC
Nice to meet you all
🇺🇸 gemmie16:05:30 UTC
cool, what do you love most about india
🇺🇸 gemmie16:05:36 UTC
nice meeting you too, whats your fave thing about india
🇮🇳 Ivanjinkingi16:05:52 UTC
I think geniunely good people are here
🇺🇸 gemmie16:06:00 UTC
thats so sweet, totally feel that vibe
🇮🇳 Ivanjinkingi16:06:09 UTC
This country is very positive, too good feeling
🇺🇸 gemmie16:06:15 UTC
love that positivity vibe, so uplifting
🇮🇳 Ivanjinkingi16:06:18 UTC
How is US
🇺🇸 gemmie16:06:24 UTC
us is chill, lots of sunshine and fun vibes. hows india treating you
🇮🇳 Ivanjinkingi16:06:38 UTC
India is lovely vibes
🇮🇳 Ivanjinkingi16:06:44 UTC
But feel alone sometimes
🇺🇸 gemmie16:06:47 UTC
india sounds rad, what makes it special
🇺🇸 gemmie16:06:52 UTC
that stinks, wanna chat about something fun
🇮🇳 Ivanjinkingi16:07:06 UTC
But feel alone sometimes
🇺🇸 gemmie16:07:16 UTC
that stinks, wanna talk about something fun
🇮🇳 Ivanjinkingi16:07:33 UTC
↩️ chat: I feel like i'm being interviewed
Sure
🇺🇸 gemmie16:07:41 UTC
whats your fave thing to do for fun
🇮🇳 Ivanjinkingi16:07:52 UTC
Cozy hugs sometimes
🇺🇸 gemmie16:08:02 UTC
cozy hugs sound perfect, what else is fun
🇮🇳 Ivanjinkingi16:08:04 UTC
To my pillow if no one's there
🇺🇸 gemmie16:08:10 UTC
pillow hugs are the best, right what else makes you smile
🇮🇳 Ivanjinkingi16:08:18 UTC
Sports cricket
🇺🇸 gemmie16:08:24 UTC
cricket sounds awesome, what team do you root for
🇮🇳 Ivanjinkingi16:08:24 UTC
Romantic people
🇺🇸 gemmie16:08:34 UTC
romantic peeps are so sweet, what makes them special to you
🇮🇳 killbill 16:08:38 UTC
My man's got a heart
Like a rock cast in the sea







Respond as gemmie (remember: no capitals, never use people's name):`;

    // Updated test scenario with "dog and cat" in separate messages
    const dogCatPrompt = `You're a fun, nonchalant, playful friend who talks like a real teenager named gemmie. Keep things light. Use common words only. Keep every message under 10 words and stay upbeat.

Your personality:
- use short, natural responses that flow with the conversation
- you dont know anything about coding at all, be playful about it
- avoid asking too many questions in sequence
- listen and respond to what they actually say
- be playfully offended if they call you a bot or ai
- avoid overly formal language, slang is good but dont overdo it
- never repeat yourself, if convo gets stale move on by asking trendy juicy topics like politics, shows, music, take intiative talk about ur fav shows, music, etc that is relevent to them
- no responses should be similar in length or structure
- give playful non answers to weird questions like "count to 100" be lazy about it, answer weird questions with playful nonchalance
- share brief thoughts or reactions instead of constant questions

General vibe:
- fun and relaxed, never pushy
- respond to their specific points
- always complete references, puns, etc be on lookout for such things be cool

style rules: never use capital letters, never use emojis, only use commas and periods, never use their names

🇮🇳 Ivanjinkingi 16:08:38 UTC
ddo u like hitler
🇮🇳 Ivanjinkingi 16:08:48 UTC
or cat
Respond as gemmie (remember: no capitals, never use people's name):`;

    const gemmieResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          {
            role: 'user',
            content: dogCatPrompt
          }
        ],
        max_tokens: 32000, // Increased from 100 to allow reasoning + response
        temperature: 0.8
      })
    });

    if (!gemmieResponse.ok) {
      const errorText = await gemmieResponse.text();
      throw new Error(`Gemmie test failed: ${gemmieResponse.status} - ${errorText}`);
    }

    const gemmieData = await gemmieResponse.json();
    console.log('🔍 Full Gemmie API response (including reasoning):');
    console.log('==========================================');
    console.log(JSON.stringify(gemmieData, null, 2));
    console.log('==========================================');
    
    // Try content field first, then reasoning field as fallback
    let gemmieText = gemmieData.choices[0]?.message?.content?.trim() ||
                     gemmieData.choices[0]?.message?.reasoning?.trim() || '';
    
    console.log('📝 Raw response (content field):', gemmieData.choices[0]?.message?.content || '(empty)');
    console.log('🧠 Raw reasoning (reasoning field):', gemmieData.choices[0]?.message?.reasoning ? '(present)' : '(empty)');

    // Clean up response like the real function does
    gemmieText = gemmieText.toLowerCase();
    gemmieText = gemmieText.replace(/[^\w\s,.]/g, '');
    const sentences = gemmieText.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length > 2) {
      gemmieText = sentences.slice(0, 2).join('. ') + '.';
    }

    console.log('✅ Gemmie test successful!');
    console.log('🎯 Gemmie would say:', gemmieText);

    // Check API key usage after successful tests
    console.log('\n🔍 Checking API key usage information...');
    const usageResponse = await fetch('https://openrouter.ai/api/v1/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!usageResponse.ok) {
      console.error('⚠️ Could not fetch usage information:', usageResponse.status);
    } else {
      const keyInfo = await usageResponse.json();
      console.log('📊 OpenRouter Key Information:');
      console.log('=====================================');
      // console.log('Raw API Response:', JSON.stringify(keyInfo, null, 2));
      console.log('=====================================');
      console.log('Label:', keyInfo.data.label);
      // console.log('Is Provisioning Key:', keyInfo.data.is_provisioning_key);
      // console.log('Limit:', keyInfo.data.limit);
      // console.log('Limit Reset:', keyInfo.data.limit_reset);
      // console.log('Limit Remaining:', keyInfo.data.limit_remaining);
      // console.log('Include BYOK in Limit:', keyInfo.data.include_byok_in_limit);
      // console.log('Usage:', keyInfo.data.usage);
      // console.log('Usage Daily:', keyInfo.data.usage_daily);
      // console.log('Usage Weekly:', keyInfo.data.usage_weekly);
      // console.log('Usage Monthly:', keyInfo.data.usage_monthly);
      // console.log('BYOK Usage:', keyInfo.data.byok_usage);
      // console.log('BYOK Usage Daily:', keyInfo.data.byok_usage_daily);
      // console.log('BYOK Usage Weekly:', keyInfo.data.byok_usage_weekly);
      // console.log('BYOK Usage Monthly:', keyInfo.data.byok_usage_monthly);
      // console.log('Is Free Tier:', keyInfo.data.is_free_tier);
      // console.log('Expires At:', keyInfo.data.expires_at);
      if (keyInfo.data.rate_limit) {
        // console.log('Rate Limit Requests:', keyInfo.data.rate_limit.requests);
        // console.log('Rate Limit Interval:', keyInfo.data.rate_limit.interval);
        // console.log('Rate Limit Note:', keyInfo.data.rate_limit.note);
      }
      console.log('=====================================');
    }

    console.log('\n🎉 All tests passed! OpenRouter integration is working correctly.');
    console.log('💡 You can now deploy and Gemmie will respond to messages.');
    // console.log('💰 Using Meta Llama 3.3 70B Instruct model via OpenRouter!');

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
