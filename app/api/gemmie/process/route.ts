import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { generateGemmieResponse, generateGemmieResponseForContext, sendGemmieMessage } from '@/lib/openrouter';
import { getPusherInstance } from '@/lib/pusher';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import DeletedMessageByGemmie from '@/models/DeletedMessageByGemmie';
import EditedMessageByGemmie from '@/models/EditedMessageByGemmie';
import mongoose from 'mongoose';

// Get country flag
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'XX') return '🌍';
  const codePoints = countryCode.toUpperCase().split('').map(c => c.charCodeAt(0) + 127397);
  return String.fromCodePoint(...codePoints);
}

// Check if response is too similar to recent messages using AI
async function checkResponseSimilarity(newResponse: string, recentMessages: any[]): Promise<{ shouldSkip: boolean; similarityScore: number; similarMessage?: string }> {
  if (recentMessages.length === 0) {
    return { shouldSkip: false, similarityScore: 0 };
  }

  // Get the most recent message to compare against
  const mostRecentMessage = recentMessages[0].content;
  
  // Create context showing the conversation flow
  const contextMessages = recentMessages.slice(0, 5).map((msg, index) =>
    `${index + 1}. ${msg.userName}: "${msg.content}" (${new Date(msg.timestamp).toISOString()})`
  ).join('\n');

  const similarityPrompt = `You are checking if Gemmie's new response is too similar to her OWN recent responses. This mechanism exists because Gemmie is activated whenever ANY user sends a message, so when multiple users send messages in short succession, Gemmie might respond multiple times with similar content if not filtered.

BACKGROUND: This chatroom has a delayed response system where each user message can trigger Gemmie's response after a short delay. During message bursts (multiple messages in quick succession), this system might generate several Gemmie responses in sequence, potentially leading to repetitive content if not checked.

NEW RESPONSE FROM GEMMIE:
"${newResponse}"

FULL CONVERSATION CONTEXT (for understanding the flow, but only compare Gemmie's messages):
${contextMessages}

IMPORTANT ANALYSIS RULES:
- You are ONLY checking for similarity between Gemmie's new response and her OWN previous messages
- IGNORE other users' messages for similarity comparison - they are just for context
- Look for repeated phrases, same intent, or very similar structure specifically in Gemmie's messages
- Minor word changes or punctuation differences don't count as different enough
- If multiple users are having similar conversations, Gemmie should vary her responses more
- If both messages are very short (under 10 words), be more strict about similarity
- If both messages are longer, allow some variation in expression
- Consider the context: if users are sending many messages quickly, Gemmie should avoid repetitive responses

Respond ONLY with a JSON object:
{"shouldSkip": true/false, "similarityScore": 0-100, "explanation": "brief reason"}

shouldSkip = true if Gemmie's new response is too similar to her OWN previous messages (70%+ similarity)
similarityScore = how similar Gemmie's new response is to her OWN previous messages (0-100 scale)`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [{ role: 'user', content: similarityPrompt }],
        max_tokens: 150,
        temperature: 0.1
      })
    });

    if (response.ok) {
      const data = await response.json();
      const resultText = data.choices[0]?.message?.content?.trim();
      
      try {
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            shouldSkip: parsed.shouldSkip || false,
            similarityScore: parsed.similarityScore || 0,
            similarMessage: mostRecentMessage
          };
        }
      } catch (parseError) {
        console.error('Failed to parse similarity check JSON:', parseError);
      }
    }
  } catch (error) {
    console.error('Error in similarity check:', error);
  }

  return { shouldSkip: false, similarityScore: 0 };
}

// This API route handles the delayed Gemmie response
export async function POST(request: NextRequest) {
  // Create a receiver for signature verification
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

    // Verify the request is coming from QStash
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.text();

    try {
      // Verify the signature
      const isValid = await receiver.verify({
        signature,
        body,
        // Remove url from verification to fix signature mismatch
      });

      if (!isValid) {
        console.error('❌ Invalid QStash signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } catch (error) {
      console.error('❌ Signature verification failed:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  try {
    // Connect to database early for similarity checks
    await connectDB();
    
    // Clear the job scheduled key to allow new messages to trigger QStash jobs
    // This is important so that if resetGemmieTimer is called later for a rescheduled job,
    // it can successfully store the new QStash message ID.
    const redisClient = await import('@/lib/redis');
    await redisClient.default.del('gemmie:job-scheduled');
    console.log('🔓 Cleared gemmie:job-scheduled key. New messages can now schedule QStash jobs.');

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (initialParseError: any) {
      console.warn('Initial JSON.parse failed, attempting to extract JSON from body:', initialParseError.message);
      // Attempt to find a JSON object string within the body
      // This is a common pattern if QStash adds prefixes or the body is not plain JSON
      const jsonMatch = body.match(/\{[\s\S]*\}/); // Find first {...}
      if (jsonMatch) {
        try {
          parsedBody = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.error('Failed to parse extracted JSON:', secondParseError);
          throw new Error('Invalid JSON format in request body');
        }
      } else {
        throw new Error('No valid JSON object found in request body');
      }
    }
    
    const { userName, userMessage, userCountry } = parsedBody;
    
    if (!userName || !userMessage || !userCountry) {
      throw new Error('Missing required fields in request body: userName, userMessage, or userCountry');
    }

    console.log('🤖 Starting delayed Gemmie response process for:', userName);

    // Get queued messages that were present before this QStash job started processing.
    const { getAndClearGemmieQueue } = await import('@/lib/gemmie-timer');
    const queuedMessagesAtStart = await getAndClearGemmieQueue();

    // Prepare all messages for context (current message + messages already in queue)
    const allMessagesForContext = [
      { userName, userMessage, userCountry, timestamp: Math.floor(Date.now() / 1000) },
      ...queuedMessagesAtStart // These are already objects with userName, userMessage, userCountry, timestamp
    ];

    console.log(`🧠 Generating AI response based on ${allMessagesForContext.length} messages...`);

    // Format messages for context with timestamp and country flag
    const formatMessageWithContext = (msg: any) => {
      const flag = msg.userCountry ? getCountryFlag(msg.userCountry) : '🌍';
      return `${msg.userName} ${flag} from ${msg.userCountry} [${new Date(msg.timestamp * 1000).toISOString()}]: ${msg.userMessage}`;
    };

    const contextString = allMessagesForContext.map(formatMessageWithContext).join('\n---\n');

    // Generate response using all messages as context
    const response = await generateGemmieResponseForContext(
      userName, 
      contextString, 
      userCountry, 
      allMessagesForContext
    );
    console.log('💬 Generated response:', response);

    // Simulate realistic typing delay based on response length
    const words = (response.match(/\S+/g) || []).length;
    const typingSpeedWps = 1.3; // words/sec (chatgpt said 1.3 word per second for 100 wpm)
    let typingDelaySec = words / typingSpeedWps;
    typingDelaySec = Math.max(1, Math.min(10, typingDelaySec)); // cap 1-10s
    typingDelaySec *= (0.8 + Math.random() * 0.4); // 20% variance
    const typingDelayMs = typingDelaySec * 1000;
    console.log(`⌨️ Typing ${words} words: ~${Math.round(typingDelayMs)}ms`);
    await new Promise(resolve => setTimeout(resolve, typingDelayMs));

    // Check for similarity with recent messages from GEMMIE only before sending
    console.log('🔍 Checking for similarity with recent Gemmie messages only...');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Get all recent messages for context (for AI understanding)
    const allRecentMessages = await Message.find({
      timestamp: { $gte: tenMinutesAgo }
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('_id content userName timestamp')
      .lean();
    
    // Get only Gemmie messages for similarity comparison
    const gemmieMessages = await Message.find({
      userName: 'gemmie',
      timestamp: { $gte: tenMinutesAgo }
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('_id content userName timestamp')
      .lean();

    const similarityCheck = await checkResponseSimilarity(response, gemmieMessages);
    
    if (similarityCheck.shouldSkip) {
      console.log(`⚠️ Response too similar to recent message (${similarityCheck.similarityScore}%), skipping send`);
      console.log(`📝 Similar message: "${similarityCheck.similarMessage}"`);
      return NextResponse.json({ success: true, skipped: true, reason: 'similarity' });
    }

    // Send to chat
    console.log('📤 Sending Gemmie message to chat...');
    await sendGemmieMessage(response);

    // Trigger Pusher event for real-time update
    const pusher = getPusherInstance();
    const gemmieMessage = {
      _id: new Date().getTime().toString(), // Temporary ID
      content: response,
      userName: 'gemmie',
      userCountry: 'US', // Default country for Gemmie
      timestamp: new Date(),
      attachments: [],
      replyTo: null,
      reactions: [],
      edited: false,
      editedAt: null
    };

    await pusher.trigger('chat-room', 'new-message', gemmieMessage);
    console.log('✅ Delayed Gemmie response sent for the initial message(s).');

    // Check Gemmie's recent messages for repetition and delete if needed
    console.log('🔍 Checking Gemmie messages for repetition...');

    // Filter for only Gemmie messages from the all recent messages
    const gemmieMessagesForRepetition = allRecentMessages.filter((msg: any) => msg.userName === 'gemmie');

    if (gemmieMessagesForRepetition.length > 1) {
      const messagesContext = gemmieMessagesForRepetition.map((msg: any, index: number) =>
        `${index + 1}. ID: ${msg._id} Content: "${msg.content}" Time: ${new Date(msg.timestamp).toISOString()}`
      ).join('\n');

      const reviewPrompt = `Review these last ${gemmieMessagesForRepetition.length} Gemmie messages (1=newest, ${gemmieMessagesForRepetition.length}=oldest) for repetition or similarity.

${messagesContext}

IMPORTANT RULES:
- You can ONLY delete Gemmie's most recent message (index 1) or the second most recent message (index 2)
- Do NOT delete messages from index 3 or higher (older messages)
- Only delete if there's clear repetition between the most recent messages
- Prefer deleting the older of the two repetitive messages
- CRITICAL: You can only delete older message only if it was sent within 120 seconds of the most recent message. Check the timestamps and only delete if the time difference is 120 seconds or less.

Output ONLY valid JSON: {"deleteIndices": [1]} or {"deleteIndices": [2]} or {"deleteIndices": []} if none needed.
Allowed indices: [1] or [2] only!`;

      try {
        const reviewResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
            'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'x-ai/grok-4.1-fast',
            messages: [{ role: 'user', content: reviewPrompt }],
            max_tokens: 200,
            temperature: 0.1
          })
        });

        if (reviewResponse.ok) {
          const data = await reviewResponse.json();
          const reviewText = data.choices[0]?.message?.content?.trim();
          console.log('🤖 AI review:', reviewText);

          let deleteIndices: number[] = [];
          try {
            const jsonMatch = reviewText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              deleteIndices = Array.isArray(parsed.deleteIndices) ? parsed.deleteIndices.map((i: any) => parseInt(i)) : [];
            }
          } catch (parseError) {
            console.error('Failed to parse review JSON:', parseError);
          }

          console.log(`🗑️ Processing ${deleteIndices.length} deletion indices`);
          for (const idx of deleteIndices) {
            // Only allow indices 1 or 2 (most recent or second most recent)
            if (idx !== 1 && idx !== 2) {
              console.log(`⚠️ Invalid index ${idx}, only indices 1 and 2 are allowed, skipping`);
              continue;
            }
            if (idx > gemmieMessagesForRepetition.length) {
              console.log(`ℹ️ Index ${idx} out of range, skipping`);
              continue;
            }
            const msgIndex = idx - 1;
            const msg = gemmieMessagesForRepetition[msgIndex];
            const idStr = msg._id.toString();
            try {
              const id = new mongoose.Types.ObjectId(idStr);
              const message = await Message.findById(id);
              if (message && message.userName === 'gemmie') {
                // Store the deleted message in the DeletedMessageByGemmie collection
                const deletedMessage = new DeletedMessageByGemmie({
                  originalMessageId: id,
                  content: message.content,
                  userName: message.userName,
                  userCountry: message.userCountry,
                  timestamp: message.timestamp,
                  attachments: message.attachments,
                  replyTo: message.replyTo,
                  reactions: message.reactions,
                  edited: message.edited,
                  editedAt: message.editedAt,
                  deletionReason: 'repetition'
                });
                
                await deletedMessage.save();
                console.log(`💾 Stored deleted message ${idStr} in DeletedMessageByGemmie collection`);
                
                // Delete the original message
                await Message.findByIdAndDelete(id);
                const eventData = { messageId: idStr };
                console.log('🗑️ About to trigger Pusher delete event with data:', eventData);
                await pusher.trigger('chat-room', 'delete-message', eventData);
                console.log(`🗑️ Successfully deleted repetitive Gemmie message index ${idx} (${idStr}) and triggered Pusher event`);
              } else {
                console.log(`ℹ️ Message index ${idx} (${idStr}) not found or not Gemmie's, skipping delete`);
              }
            } catch (deleteError) {
              console.error(`❌ Failed to delete message index ${idx} (${idStr}):`, deleteError);
            }
          }
        } else {
          console.error('AI review failed:', reviewResponse.status);
        }
      } catch (reviewError) {
        console.error('Error in Gemmie self-review:', reviewError);
      }
    }

    // Check Gemmie's recent messages for user feedback and edit if needed
    console.log('🔍 Checking Gemmie messages for user feedback...');
    const recentGemmieMessagesForEdit = await Message.find({
      userName: 'gemmie',
      timestamp: { $gte: tenMinutesAgo }
    })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('_id content timestamp')
      .lean();

    if (recentGemmieMessagesForEdit.length > 0) {
      console.log(`📝 Edit check: Found ${recentGemmieMessagesForEdit.length} recent Gemmie messages to review`);
      console.log(`📝 User message: "${userName}: ${userMessage}"`);
      
      const messagesContext = recentGemmieMessagesForEdit.map((msg, index) =>
        `${index + 1}. ID: ${msg._id} Content: "${msg.content}" Time: ${new Date(msg.timestamp).toISOString()}`
      ).join('\n');

      console.log('📋 Detailed edit system debug info:');
      console.log('- User message for analysis:', `"${userName}: ${userMessage}"`);
      console.log('- Available messages for editing:');
      recentGemmieMessagesForEdit.forEach((msg, index) => {
        console.log(`  ${index + 1}. ID: ${msg._id}, Content: "${msg.content}", Time: ${new Date(msg.timestamp).toISOString()}`);
      });

      const reviewPrompt = `You are reviewing Gemmie's recent messages to decide whether one of them should be edited based on the user's latest reaction.

User's latest message:
"${userName}: ${userMessage}"

Recent Gemmie messages (1 = newest, 5 = oldest):
${messagesContext}

IMPORTANT RULES:
- You can ONLY edit Gemmie's most recent message (index 1) or the second most recent message (index 2)
- Do NOT edit messages from index 3 or higher (older messages)
- ALWAYS check for spelling errors, grammar mistakes, and typos FIRST, even without explicit user feedback
- Common typos to fix: "everytime" → "every time", "alot" → "a lot", "dont" → "don't", "cant" → "can't", "wont" → "won't", "teh" → "the", "goin" → "going", "runnin" → "running", etc.
- Intentional slang/shortcuts that are OK: "gonna", "wanna", "gimme", "cause" (as in "because"), "cos" (as in "because")
- Fix misspellings even if they look like slang: "goin" should be "going", "runnin" should be "running"
- Also consider editing if the user's latest message expresses confusion, accuses Gemmie of sounding like a bot, says she made a mistake, or jokes about her tone.
- For clarification requests: Only edit if it's a small, relevant clarification that can be naturally added to the existing message. For larger explanations or new information, Gemmie should send a new message instead.
- If editing is needed, choose the **single most relevant** Gemmie message (usually the most recent one).
- For corrections: Fix typos, grammar mistakes, or clarify confusing statements. Make it look like a natural self-correction.
- For small clarifications: Add brief, relevant details that naturally extend the original message. Use phrases like "Oh wait, actually..." or "I should mention..."
- The edit should sound natural and human-like, as if Gemmie just noticed something and is improving her message.
- Keep edits short and plausible as a real chat message.

Examples:
- User: "lol you type like a bot" → Edit to sound more casual and human
- User: "that doesn't make sense" → Edit to clarify the meaning
- User: "can you explain more about that" → Usually send new message, but if editing, only add small relevant detail
- If Gemmie made a typo like "everytime": Fix it naturally like "whoops, every time" or just "every time"
- If Gemmie made a typo like "alot": Fix it naturally like "actually, a lot" or just "a lot"
- If Gemmie made "goin": Fix it to "going" (not intentional slang, it's a misspelling)
- If Gemmie made "runnin": Fix it to "running" (not intentional slang, it's a misspelling)

Output ONLY valid JSON with this shape:

{"editIndex": 1, "newContent": "updated text here"}

If no edit is needed:

{"editIndex": null, "newContent": null}

Allowed indices: [1] or [2] only!`;

      try {
        console.log('🚀 Sending edit review prompt to AI...');
        const reviewResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
            'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'x-ai/grok-4.1-fast',
            messages: [{ role: 'user', content: reviewPrompt }],
            max_tokens: 200,
            temperature: 0.1
          })
        });

        if (reviewResponse.ok) {
          const data = await reviewResponse.json();
          const reviewText = data.choices[0]?.message?.content?.trim();
          console.log('🤖 AI review for editing:', reviewText);

          let editIndex: number | null = null;
          let newContent: string | null = null;
          let rawJsonExtracted = false;
          
          try {
            console.log('🔍 Attempting to parse JSON from AI response...');
            const jsonMatch = reviewText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              console.log('✅ Found JSON object in response:', jsonMatch[0]);
              const parsed = JSON.parse(jsonMatch[0]);
              editIndex = parsed.editIndex !== null ? parseInt(parsed.editIndex) : null;
              newContent = parsed.newContent || null;
              rawJsonExtracted = true;
              console.log('✅ Successfully parsed JSON:', { editIndex, newContent });
            } else {
              console.log('❌ No JSON object found in AI response');
            }
          } catch (parseError) {
            console.error('❌ Failed to parse edit review JSON:', parseError);
            console.error('📝 Raw AI response that failed to parse:', reviewText);
          }

          // Additional validation for edit index restrictions
          if (editIndex !== null && (editIndex < 1 || editIndex > 2)) {
            console.log(`⚠️ Invalid edit index ${editIndex}, only indices 1 and 2 are allowed, setting to null`);
            editIndex = null;
            newContent = null;
          }

          if (editIndex !== null && newContent !== null && rawJsonExtracted) {
            const msgIndex = editIndex - 1;
            const msg = recentGemmieMessagesForEdit[msgIndex];
            const idStr = msg._id.toString();
            
            console.log(`🎯 Attempting to edit message index ${editIndex} (${idStr}) with new content: "${newContent}"`);
            
            try {
              const id = new mongoose.Types.ObjectId(idStr);
              const message = await Message.findById(id);
              if (message && message.userName === 'gemmie') {
                // Store the edit in the EditedMessageByGemmie collection
                const editedMessage = new EditedMessageByGemmie({
                  originalMessageId: id,
                  originalContent: message.content,
                  newContent: newContent,
                  editReason: 'user-feedback',
                  userName: message.userName,
                  userCountry: message.userCountry,
                  timestamp: message.timestamp,
                  attachments: message.attachments,
                  replyTo: message.replyTo,
                  reactions: message.reactions,
                  edited: message.edited,
                  editedAtOriginal: message.editedAt,
                  triggerMessage: `${userName}: ${userMessage}`,
                  aiPrompt: reviewPrompt
                });
                
                await editedMessage.save();
                console.log(`💾 Stored edited message ${idStr} in EditedMessageByGemmie collection`);
                
                // Update the original message
                message.content = newContent;
                message.edited = true;
                message.editedAt = new Date();
                await message.save();
                
                // Trigger Pusher event for real-time update
                const pusher = getPusherInstance();
                await pusher.trigger('chat-room', 'edit-message', {
                  messageId: idStr,
                  newContent: newContent
                });
                console.log(`✅ Successfully edited Gemmie message index ${editIndex} (${idStr})`);
              } else {
                console.log(`ℹ️ Message index ${editIndex} (${idStr}) not found or not Gemmie's, skipping edit`);
              }
            } catch (editError) {
              console.error(`❌ Failed to edit message index ${editIndex} (${idStr}):`, editError);
            }
          } else {
            console.log(`📋 Edit decision: editIndex=${editIndex}, newContent=${newContent}, rawJsonExtracted=${rawJsonExtracted}`);
            if (editIndex === null || newContent === null) {
              console.log('ℹ️ No edit needed or JSON parsing failed');
            }
          }
        } else {
          console.error('AI edit review failed:', reviewResponse.status);
          const errorText = await reviewResponse.text();
          console.error('📝 Error response from AI:', errorText);
        }
      } catch (reviewError) {
        console.error('❌ Error in Gemmie self-edit review:', reviewError);
      }
    }


    // --- Check for new messages that arrived during processing ---
    const { getAndClearGemmieQueue: getQueueAgain, resetGemmieTimer: rescheduleJob, queueGemmieMessage } = await import('@/lib/gemmie-timer');
    const newlyQueuedMessages = await getQueueAgain();
    
    let shouldClearJobActive = true; // Assume we'll clear the flag

    if (newlyQueuedMessages.length > 0) {
      console.log(`📥 Found ${newlyQueuedMessages.length} new message(s) in queue after processing. Rescheduling for the next one.`);
      
      const nextMessageToProcess = newlyQueuedMessages[0]; // Process the oldest one next
      console.log('🔄 Scheduling next QStash job for:', nextMessageToProcess.userName);

      // Reschedule for the next message
      await rescheduleJob(nextMessageToProcess.userName, nextMessageToProcess.userMessage, nextMessageToProcess.userCountry);
      
      // Re-queue the remaining messages (if any)
      const remainingMessages = newlyQueuedMessages.slice(1);
      for (const remainingMsg of remainingMessages) {
        await queueGemmieMessage(remainingMsg.userName, remainingMsg.userMessage, remainingMsg.userCountry);
        console.log(`📝 Re-queued remaining message from: ${remainingMsg.userName}`);
      }
      
      console.log('✅ Next QStash job scheduled and remaining messages re-queued. gemmie:job-active remains set.');
      shouldClearJobActive = false; // Do not clear the flag, a new job is scheduled
    } else {
      console.log('🧹 No new messages found in queue after processing.');
    }

    if (shouldClearJobActive) {
      const { clearJobActive } = await import('@/lib/gemmie-timer');
      await clearJobActive();
      console.log('🔓 Cleared job active flag as queue is now empty.');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error in delayed Gemmie response:', error);
    // Important: Do not clear job active flag here if the error is after rescheduling.
    // The finally block will handle cleanup for errors during the main processing part.
    return NextResponse.json({ error: 'Failed to process delayed response' }, { status: 500 });
  } finally {
    // Ensure job active flag is cleared only if an error occurred before
    // the main logic could decide to reschedule or clear it normally.
    // This is a fallback for unexpected errors.
    try {
      // Check if we are in an error state that wasn't handled by the main logic
      // This is a bit tricky to do perfectly without more state.
      // For now, this is a general cleanup for any error path that might leave the lock.
      // If the main logic successfully rescheduled, this clearJobActive would be problematic.
      // However, if an error occurs *before* `shouldClearJobActive` is determined,
      // this is good safety.
      const { clearJobActive, getAndClearGemmieQueue: checkQueueForErrorHandling } = await import('@/lib/gemmie-timer');
      
      // Only clear if an error occurred and we want to ensure the lock is released
      // This logic might need refinement if errors can happen after rescheduling.
      // For safety, if an error occurs, we try to release the lock.
      // The main logic handles the "happy path" or rescheduling path.
      console.log('🔧 Finally block: Checking if job active flag needs cleanup due to error.');
      const redis = (await import('@/lib/redis')).default;
      const JOB_ACTIVE_KEY = 'gemmie:job-active';
      const isActive = await redis.get(JOB_ACTIVE_KEY);
      if (isActive === 'active') {
        await clearJobActive();
        console.log('🔓 Cleared job active flag in finally block (error path).');
      } else {
        console.log('ℹ️ Job active flag already cleared by main logic.');
      }
    } catch (releaseError) {
      console.error('❌ Failed to clear job active flag in finally block:', releaseError);
    }
  }
}

export const dynamic = 'force-dynamic';
