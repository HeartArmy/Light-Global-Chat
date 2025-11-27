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
    await connectDB();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentGemmieMessages = await Message.find({
      userName: 'gemmie',
      timestamp: { $gte: tenMinutesAgo }
    })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('_id content timestamp')
      .lean();

    if (recentGemmieMessages.length > 1) {
      const messagesContext = recentGemmieMessages.map((msg, index) =>
        `${index + 1}. ID: ${msg._id} Content: "${msg.content}" Time: ${new Date(msg.timestamp).toISOString()}`
      ).join('\n');

      const reviewPrompt = `Review these last 5 Gemmie messages (1=newest, 5=oldest) for repetition or similarity.

${messagesContext}

Decide if any should be deleted to avoid repetition. Prefer deleting older repetitive ones (higher numbers).

Output ONLY valid JSON: {"deleteIndices": [1,3]} or {"deleteIndices": []} if none needed. Use 1-based indices (1=newest).`;

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

          console.log(`🗑️ Deleting ${deleteIndices.length} repetitive messages by index`);
          for (const idx of deleteIndices) {
            if (idx < 1 || idx > recentGemmieMessages.length) {
              console.log(`ℹ️ Invalid index ${idx}, skipping`);
              continue;
            }
            const msgIndex = idx - 1;
            const msg = recentGemmieMessages[msgIndex];
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
      const messagesContext = recentGemmieMessagesForEdit.map((msg, index) =>
        `${index + 1}. ID: ${msg._id} Content: "${msg.content}" Time: ${new Date(msg.timestamp).toISOString()}`
      ).join('\n');

      const reviewPrompt = `You are reviewing Gemmie's recent messages to decide whether one of them should be edited based on the user's latest reaction.

User's latest message:
"${userName}: ${userMessage}"

Recent Gemmie messages (1 = newest, 5 = oldest):
${messagesContext}

Rules for deciding whether to edit:
- Only consider editing if the user's latest message expresses confusion, accuses Gemmie of sounding like a bot, says she made a mistake, or jokes about her tone.
- For clarification requests: Only edit if it's a small, relevant clarification that can be naturally added to the existing message. For larger explanations or new information, Gemmie should send a new message instead.
- If editing is needed, choose the **single most relevant** Gemmie message (usually the one the user reacted to).
- For corrections: Fix typos, grammar mistakes, or clarify confusing statements. Make it look like a natural self-correction.
- For small clarifications: Add brief, relevant details that naturally extend the original message. Use phrases like "Oh wait, actually..." or "I should mention..."
- The edit should sound natural and human-like, as if Gemmie just noticed something and is improving her message.
- Keep edits short and plausible as a real chat message.

Examples:
- User: "lol you type like a bot" → Edit to sound more casual and human
- User: "that doesn't make sense" → Edit to clarify the meaning
- User: "can you explain more about that" → Usually send new message, but if editing, only add small relevant detail
- If Gemmie made a typo: Fix it naturally like "whoops" or just correct it

Output ONLY valid JSON with this shape:

{"editIndex": 1, "newContent": "updated text here"}

If no edit is needed:

{"editIndex": null, "newContent": null}`;

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
          console.log('🤖 AI review for editing:', reviewText);

          let editIndex: number | null = null;
          let newContent: string | null = null;
          try {
            const jsonMatch = reviewText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              editIndex = parsed.editIndex !== null ? parseInt(parsed.editIndex) : null;
              newContent = parsed.newContent || null;
            }
          } catch (parseError) {
            console.error('Failed to parse edit review JSON:', parseError);
          }

          if (editIndex !== null && newContent !== null && editIndex >= 1 && editIndex <= recentGemmieMessagesForEdit.length) {
            const msgIndex = editIndex - 1;
            const msg = recentGemmieMessagesForEdit[msgIndex];
            const idStr = msg._id.toString();
            
            try {
              const id = new mongoose.Types.ObjectId(idStr);
              const message = await Message.findById(id);
              if (message && message.userName === 'gemmie') {
                // Store the edit in the EditedMessageByGemmie collection
                const editedMessage = new EditedMessageByGemmie({
                  originalMessageId: id,
                  originalContent: message.content,
                  newContent: newContent,
                  editReason: 'user-feedback', // This can now include corrections and enhancements
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
          }
        } else {
          console.error('AI edit review failed:', reviewResponse.status);
        }
      } catch (reviewError) {
        console.error('Error in Gemmie self-edit review:', reviewError);
      }
    }

    // Check for message corrections - intentionally make small mistakes and fix them
    console.log('🔍 Checking for message correction opportunities...');
    const correctionWindow = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const recentGemmieMessagesForCorrection = await Message.find({
      userName: 'gemmie',
      timestamp: { $gte: correctionWindow },
      edited: false // Only consider messages that haven't been edited yet
    })
      .sort({ timestamp: -1 })
      .limit(3)
      .select('_id content timestamp')
      .lean();

    if (recentGemmieMessagesForCorrection.length > 0 && Math.random() < 0.3) { // 30% chance
      const randomMessage = recentGemmieMessagesForCorrection[Math.floor(Math.random() * recentGemmieMessagesForCorrection.length)];
      const idStr = randomMessage._id.toString();
      
      // Common mistakes to make (actual typos, not just casual abbreviations)
      const mistakes = [
        { pattern: /\b(think)\b/g, replacement: (match: string) => 'thikn' }, // common typo
        { pattern: /\b(the)\b/g, replacement: (match: string) => 'teh' }, // common transposition
        { pattern: /\b(what)\b/g, replacement: (match: string) => 'waht' }, // common transposition
        { pattern: /\b(have)\b/g, replacement: (match: string) => 'haev' }, // common transposition
        { pattern: /\b(they)\b/g, replacement: (match: string) => 'thye' }, // common transposition
        { pattern: /\b(friend)\b/g, replacement: (match: string) => 'freind' }, // common misspelling
        { pattern: /\b(really)\b/g, replacement: (match: string) => 'realy' }, // common misspelling
        { pattern: /\b(because)\b/g, replacement: (match: string) => 'becuase' }, // common misspelling
      ];
      
      const randomMistake = mistakes[Math.floor(Math.random() * mistakes.length)];
      const originalContent = randomMessage.content;
      const mistakeContent = originalContent.replace(randomMistake.pattern, randomMistake.replacement);
      
      // Only apply mistake if it actually changes the content
      if (mistakeContent !== originalContent) {
        try {
          // First, make the mistake
          const message = await Message.findById(idStr);
          if (message) {
            message.content = mistakeContent;
            await message.save();
            
            // Trigger Pusher event for the mistake
            const pusher = getPusherInstance();
            await pusher.trigger('chat-room', 'edit-message', {
              messageId: idStr,
              newContent: mistakeContent
            });
            
            console.log(`😅 Applied intentional mistake to message ${idStr}: "${originalContent}" → "${mistakeContent}"`);
            
            // Set timeout to correct it (2-5 seconds later)
            setTimeout(async () => {
              try {
                const messageToCorrect = await Message.findById(idStr);
                if (messageToCorrect) {
                  // Store the correction in EditedMessageByGemmie
                  const correction = new EditedMessageByGemmie({
                    originalMessageId: idStr,
                    originalContent: mistakeContent,
                    newContent: originalContent,
                    editReason: 'self-correction',
                    userName: 'gemmie',
                    userCountry: messageToCorrect.userCountry,
                    timestamp: messageToCorrect.timestamp,
                    attachments: messageToCorrect.attachments,
                    replyTo: messageToCorrect.replyTo,
                    reactions: messageToCorrect.reactions,
                    edited: messageToCorrect.edited,
                    editedAtOriginal: messageToCorrect.editedAt,
                    triggerMessage: 'self-correction',
                    aiPrompt: 'Automatic typo correction'
                  });
                  
                  await correction.save();
                  
                  // Correct the message
                  messageToCorrect.content = originalContent;
                  messageToCorrect.edited = true;
                  messageToCorrect.editedAt = new Date();
                  await messageToCorrect.save();
                  
                  // Trigger Pusher event for the correction
                  await pusher.trigger('chat-room', 'edit-message', {
                    messageId: idStr,
                    newContent: originalContent
                  });
                  
                  console.log(`✅ Corrected mistake in message ${idStr}: "${mistakeContent}" → "${originalContent}"`);
                }
              } catch (correctError) {
                console.error(`❌ Failed to correct message ${idStr}:`, correctError);
              }
            }, Math.random() * 3000 + 2000); // 2-5 seconds delay
          }
        } catch (applyError) {
          console.error(`❌ Failed to apply mistake to message ${idStr}:`, applyError);
        }
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
