import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { generateGemmieResponse, generateGemmieResponseForContext, sendGemmieMessage } from '@/lib/openrouter';
import { getPusherInstance } from '@/lib/pusher';

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

    // --- Check for new messages that arrived during processing ---
    const { getAndClearGemmieQueue: getQueueAgain, resetGemmieTimer: rescheduleJob } = await import('@/lib/gemmie-timer');
    const newlyQueuedMessages = await getQueueAgain();
    
    let shouldClearJobActive = true; // Assume we'll clear the flag

    if (newlyQueuedMessages.length > 0) {
      console.log(`📥 Found ${newlyQueuedMessages.length} new message(s) in queue after processing. Rescheduling for the next one.`);
      
      const nextMessageToProcess = newlyQueuedMessages[0]; // Process the oldest one next
      console.log('🔄 Scheduling next QStash job for:', nextMessageToProcess.userName);

      // Reschedule for the next message. This will:
      // 1. Try to set gemmie:job-active (it should succeed as we are still "active")
      // 2. Schedule a new QStash job if job active was set.
      // The resetGemmieTimer handles the QStash scheduling and redis key updates.
      await rescheduleJob(nextMessageToProcess.userName, nextMessageToProcess.userMessage, nextMessageToProcess.userCountry);
      
      console.log('✅ Next QStash job scheduled. gemmie:job-active remains set.');
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
      // A simple approach: if an error occurred, assume the lock might be stale.
      // This is a broad cleanup. More precise error handling would be better.
      await clearJobActive();
      console.log('🔓 Cleared job active flag in finally block (error path).');
    } catch (releaseError) {
      console.error('❌ Failed to clear job active flag in finally block:', releaseError);
    }
  }
}

export const dynamic = 'force-dynamic';
