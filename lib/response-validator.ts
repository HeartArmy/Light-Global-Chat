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

export function hasProblematicPatterns(response: string): { hasProblem: boolean; pattern?: string; reason: string } {
  if (!response || typeof response !== 'string') {
    return { hasProblem: true, reason: 'Empty or invalid response' };
  }

  const trimmedResponse = response.trim();
  
  // Check for problematic patterns
  for (const pattern of PROBLEMATIC_PATTERNS) {
    if (pattern.test(trimmedResponse)) {
      console.log('🚨 Problematic pattern detected:', pattern.source);
      return {
        hasProblem: true,
        pattern: pattern.source,
        reason: `Detected problematic pattern: ${pattern.source}`
      };
    }
  }

  // Check for excessive length that might indicate verbose output
  const wordCount = trimmedResponse.split(/\s+/).length;
  if (wordCount > 50) {
    console.log('🚨 Excessively long response detected:', wordCount, 'words');
    return {
      hasProblem: true,
      reason: `Response too long: ${wordCount} words`
    };
  }

  return { hasProblem: false, reason: 'Response is valid' };
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
        model: 'allenai/olmo-3-32b-think:free',
        messages: [
          {
            role: 'user',
            content: validationPrompt
          }
        ],
        max_tokens: 32000,
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