require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('Error: OPENROUTER_API_KEY environment variable not set.');
  process.exit(1);
}

console.log('🔑 Testing OpenRouter API Key Status...');
console.log('✅ API key found');
console.log('🔑 Key starts with:', OPENROUTER_API_KEY.substring(0, 20) + '...');

async function checkOpenRouterKey() {
  try {
    console.log('📡 Fetching key info from OpenRouter...');
    const response = await fetch('https://openrouter.ai/api/v1/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const keyInfo = await response.json();
    console.log('📊 OpenRouter Key Information:');
    console.log('=====================================');
    console.log('Raw API Response:', JSON.stringify(keyInfo, null, 2));
    console.log('=====================================');
    console.log('Label:', keyInfo.data.label);
    console.log('Is Provisioning Key:', keyInfo.data.is_provisioning_key);
    console.log('Limit:', keyInfo.data.limit);
    console.log('Limit Reset:', keyInfo.data.limit_reset);
    console.log('Limit Remaining:', keyInfo.data.limit_remaining);
    console.log('Include BYOK in Limit:', keyInfo.data.include_byok_in_limit);
    console.log('Usage:', keyInfo.data.usage);
    console.log('Usage Daily:', keyInfo.data.usage_daily);
    console.log('Usage Weekly:', keyInfo.data.usage_weekly);
    console.log('Usage Monthly:', keyInfo.data.usage_monthly);
    console.log('BYOK Usage:', keyInfo.data.byok_usage);
    console.log('BYOK Usage Daily:', keyInfo.data.byok_usage_daily);
    console.log('BYOK Usage Weekly:', keyInfo.data.byok_usage_weekly);
    console.log('BYOK Usage Monthly:', keyInfo.data.byok_usage_monthly);
    console.log('Is Free Tier:', keyInfo.data.is_free_tier);
    console.log('Expires At:', keyInfo.data.expires_at);
    if (keyInfo.data.rate_limit) {
      console.log('Rate Limit Requests:', keyInfo.data.rate_limit.requests);
      console.log('Rate Limit Interval:', keyInfo.data.rate_limit.interval);
      console.log('Rate Limit Note:', keyInfo.data.rate_limit.note);
    } else {
      console.log('Rate Limit:', 'N/A');
    }
    console.log('=====================================');
  } catch (error) {
    console.error('❌ OpenRouter API test failed:');
    console.error('🔍 Error details:', error.message);
    process.exit(1);
  }
}

checkOpenRouterKey();
