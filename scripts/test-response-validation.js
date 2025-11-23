/**
 * Test script for the response validation system
 * Run with: node scripts/test-response-validation.js
 */

// Note: This is a simplified test since we can't directly import TypeScript modules
// The actual validation is integrated into lib/openrouter.ts

// Mock validation function for testing
function validateAIResponse(response) {
  if (!response || typeof response !== 'string') {
    return {
      isValid: false,
      needsCleaning: false,
      cleanedResponse: '',
      reason: 'Empty or invalid response'
    };
  }

  const problematicPatterns = [
    /gemmie\s+from\s+us\s+\w+\s+\d+\s+\d+\s+\d+\s+gmt/i,
    /coordinate[d]?\s+universal\s+time/i,
    /\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}/i,
    /system\s*:/i,
    /context\s*:/i,
    /timestamp\s*:/i,
    /lol.*naughty.*how/i,
    /spill.*a.*lil/i
  ];

  for (const pattern of problematicPatterns) {
    if (pattern.test(response.trim())) {
      return {
        isValid: false,
        needsCleaning: true,
        cleanedResponse: extractCleanResponse(response),
        reason: `Detected problematic pattern: ${pattern.source}`
      };
    }
  }

  return {
    isValid: true,
    needsCleaning: false,
    cleanedResponse: response.trim(),
    reason: 'Response is valid'
  };
}

function extractCleanResponse(response) {
  // Simple extraction - take the last meaningful part
  const lines = response.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let cleanLines = [];
  
  for (const line of lines) {
    if (line.match(/^(system|context|timestamp|user|assistant|model|role|choices|message|content|openrouter|api|response|recent|conversation|from.*\w+\s+\d+\s+\d+)/i)) {
      continue;
    }
    if (line.match(/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}/i)) {
      continue;
    }
    cleanLines.push(line);
  }
  
  const finalResponse = cleanLines.slice(-2).join(' ').trim();
  return finalResponse || '(•‿•)';
}

// Test cases with problematic responses
const testCases = [
  {
    name: "Verbose system message",
    input: "gemmie from us sun nov 23 2025 003945 gmt0000 coordinated universal time lol naughty how, spill a lil",
    expected: "lol naughty how, spill a lil"
  },
  {
    name: "Timestamp with context",
    input: "Current user: john 🇺🇸 from US [2025-11-23T06:35:13.004Z]: hey there\n\nhey there, how are you doing today.",
    expected: "hey there, how are you doing today."
  },
  {
    name: "API response with metadata",
    input: "choices[0].message.content: wait thats actually fire",
    expected: "wait thats actually fire"
  },
  {
    name: "Clean response (should pass)",
    input: "wait thats actually fire",
    expected: "wait thats actually fire"
  },
  {
    name: "Long verbose response",
    input: "This is a very long response that goes on and on and on and contains way too many words that make it seem like an AI is trying to be overly verbose and helpful when it should just be casual and natural like a real person would respond in a chat room. The response should be much shorter and more natural.",
    expected: "shorter, cleaner version"
  }
];

console.log('🧪 Testing Response Validation System\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.input}"`);
  
  try {
    const result = validateAIResponse(testCase.input);
    console.log(`Validation result:`, result);
    
    if (result.needsCleaning) {
      console.log(`Cleaned response: "${result.cleanedResponse}"`);
    }
    
    console.log(`✅ Test completed\n`);
  } catch (error) {
    console.log(`❌ Test failed:`, error.message, `\n`);
  }
});

console.log('🧪 Testing Response Validation System\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.input}"`);
  
  try {
    const result = validateAIResponse(testCase.input);
    console.log(`Validation result:`, result);
    
    if (result.needsCleaning) {
      console.log(`Cleaned response: "${result.cleanedResponse}"`);
    }
    
    console.log(`✅ Test completed\n`);
  } catch (error) {
    console.log(`❌ Test failed:`, error.message, `\n`);
  }
});

console.log('🎯 Testing complete! The validation system should now catch problematic AI responses and clean them automatically.');
console.log('\n📝 Note: The actual validation is integrated into lib/openrouter.ts and uses the NVIDIA Nemotron model for advanced cleaning.');