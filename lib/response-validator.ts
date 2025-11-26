import { ResponseValidationResult } from '@/types';

/**
 * Validates and cleans AI responses to detect and fix verbose/system message outputs
 */

// Patterns that indicate problematic responses
const PROBLEMATIC_PATTERNS = [
  // System message indicators
  /gemmie\s+from\s+us\s+\w+\s+\d+\s+\d+\s+\d+\s+gmt/i,
  /coordinate[d]\s+universal\s+time/i,
  /coordinate[d]\s+universal\s+time.*lol/i,
  
  // Timestamp patterns
  /\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}/i,  // ISO timestamps
  /\d{1,2}\/\d{1,2}\/\d{4}/,  // Date formats
  /\d{1,2}:\d{2}:\d{2}/,  // Time formats
  
  // System/context indicators
  /system\s*:/i,
  /context\s*:/i,
  /timestamp\s*:/i,
  /user\s*:/i,
  /assistant\s*:/i,
  /model\s*:/i,
  /role\s*:/i,
  
  // API/response metadata
  /choices?\[\d+\]/i,
  /message\s*:\s*\{/i,
  /content\s*:/i,
  /response\s*code/i,
  /status\s*code/i,
  /openrouter/i,
  /api\s+response/i,
  
  // Conversation context remnants
  /recent\s+conversation/i,
  /conversation\s+context/i,
  /messages?\s+leading\s+up/i,
  /their\s+message\s*:/i,
  
  // Model output artifacts
  /\[.*\]\s*:.*message/i,
  /from.*\w+\s+november/i,
  /lol.*naughty.*how/i,
  /spill.*a.*lil/i,
  
  // HTML/JSON remnants
  /<.*>.*response/i,
  /\{.*"content"/i,
  /"choices"/i,
];

// Patterns that indicate legitimate content (to avoid false positives)
const LEGITIMATE_PATTERNS = [
  /\d+:\d+:\d+/g,  // Time mentions in normal conversation
  /\w+\s+\d+,\s+\d+/g,  // Date mentions
];

export function validateAIResponse(response: string): ResponseValidationResult {
  if (!response || typeof response !== 'string') {
    return {
      isValid: false,
      needsCleaning: false,
      cleanedResponse: '',
      reason: 'Empty or invalid response'
    };
  }

  const trimmedResponse = response.trim();
  
  // Check for problematic patterns
  for (const pattern of PROBLEMATIC_PATTERNS) {
    if (pattern.test(trimmedResponse)) {
      console.log('🚨 Problematic pattern detected:', pattern.source);
      return {
        isValid: false,
        needsCleaning: true,
        cleanedResponse: extractCleanResponse(trimmedResponse),
        reason: `Detected problematic pattern: ${pattern.source}`
      };
    }
  }

  // Check for excessive length that might indicate verbose output
  const wordCount = trimmedResponse.split(/\s+/).length;
  if (wordCount > 50) {
    console.log('🚨 Excessively long response detected:', wordCount, 'words');
    return {
      isValid: false,
      needsCleaning: true,
      cleanedResponse: extractCleanResponse(trimmedResponse),
      reason: `Response too long: ${wordCount} words`
    };
  }

  return {
    isValid: true,
    needsCleaning: false,
    cleanedResponse: trimmedResponse,
    reason: 'Response is valid'
  };
}

function extractCleanResponse(response: string): string {
  // Split by common separators and find the most likely actual response
  const separators = [
    'gmt',
    'coordinate', 'universal', 'time', 'from', 'nov', '2025'
  ];
  
  let bestCandidate = response;
  let bestScore = calculateResponseScore(response);
  
  // Try splitting by various separators
  for (const separator of separators) {
    const parts = response.split(new RegExp(separator, 'i'));
    
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart.length < 10) continue; // Skip very short parts
      
      const score = calculateResponseScore(trimmedPart);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = trimmedPart;
      }
    }
  }
  
  // If we found a much better candidate, use it
  if (bestScore > calculateResponseScore(response) + 0.3) {
    console.log('🎯 Extracted cleaner response:', bestCandidate);
    return bestCandidate.trim();
  }
  
  // Fallback: remove obvious system messages and take the last meaningful part
  const lines = response.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let cleanLines: string[] = [];
  
  for (const line of lines) {
    // Skip lines that look like system messages
    if (line.match(/^(system|context|timestamp|user|assistant|model|role|choices|message|content|openrouter|api|response|recent|conversation|from.*\w+\s+\d+\s+\d+)/i)) {
      continue;
    }
    // Skip lines with timestamps
    if (line.match(/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}/i)) {
      continue;
    }
    cleanLines.push(line);
  }
  
  // Take the last 1-2 lines as they're most likely to be the actual response
  const finalResponse = cleanLines.slice(-2).join(' ').trim();
  
  if (finalResponse.length > 0 && finalResponse.length < response.length) {
    console.log('🎯 Cleaned response using line filtering:', finalResponse);
    return finalResponse;
  }
  
  // Ultimate fallback: return a simple placeholder
  return '(•‿•)';
}

function calculateResponseScore(text: string): number {
  let score = 0;
  
  // Positive indicators
  if (text.match(/^[a-zA-Z\s,.!?-]+$/)) score += 0.3; // Only text characters
  if (text.length > 5 && text.length < 200) score += 0.3; // Reasonable length
  if (text.match(/[.!?]$/)) score += 0.2; // Ends with punctuation
  if (text.split(/\s+/).length < 30) score += 0.2; // Not too many words
  
  // Negative indicators
  if (text.match(/\d{4}-\d{2}-\d{2}/)) score -= 0.5; // ISO dates
  if (text.match(/system|context|timestamp|user|assistant/i)) score -= 0.4; // System keywords
  if (text.match(/[{}[\]<>]/)) score -= 0.3; // Code/JSON characters
  if (text.length > 500) score -= 0.3; // Too long
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Uses a secondary AI model to validate and clean responses
 */
export async function validateWithSecondaryAI(primaryResponse: string): Promise<string> {
  try {
    console.log('🔍 Sending response to secondary AI validator...');
    
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
        temperature: 0.1 // Low temperature for consistent cleaning
      })
    });

    if (!response.ok) {
      console.error('❌ Secondary AI validation failed:', response.status);
      throw new Error(`Validation API error: ${response.status}`);
    }

    const data = await response.json();
    const cleanedResponse = data.choices[0]?.message?.content?.trim() || '';
    
    console.log('✅ Secondary AI validation result:', cleanedResponse);
    return cleanedResponse || primaryResponse; // Fallback to original if cleaning fails
    
  } catch (error) {
    console.error('❌ Secondary AI validation error:', error);
    // Return original response if validation fails
    return primaryResponse;
  }
}