import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { generateGemmieResponse, generateGemmieResponseForContext, sendGemmieMessage } from '@/lib/openrouter';
import { getPusherInstance } from '@/lib/pusher';

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

  let lockReleased = false;
  try {
    // Clear the job scheduled key to allow new messages to trigger QStash jobs
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

    // Get queued messages
    const { getAndClearGemmieQueue } = await import('@/lib/gemmie-timer');
    const queuedMessages = await getAndClearGemmieQueue();

    // Prepare all messages for context (current message + queued messages)
    const allMessagesForContext = [
      { userName, userMessage, userCountry },
      ...queuedMessages // These are already objects with userName, userMessage, userCountry
    ];

    console.log(`🧠 Generating AI response based on ${allMessagesForContext.length} messages...`);

    // Generate response using all messages as context
    const response = await generateGemmieResponseForContext(
      userName, 
      allMessagesForContext.map(m => `${m.userName}: ${m.userMessage}`).join('\n---\n'), 
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
      userCountry: 'US',
      timestamp: new Date(),
      attachments: [],
      replyTo: null,
      reactions: [],
      edited: false,
      editedAt: null
    };

    await pusher.trigger('chat-room', 'new-message', gemmieMessage);
    console.log('✅ Delayed Gemmie response complete!');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error in delayed Gemmie response:', error);
    return NextResponse.json({ error: 'Failed to process delayed response' }, { status: 500 });
  } finally {
    // Ensure lock is released exactly once, even if an error occurs
    if (!lockReleased) {
      try {
        const { releaseGemmieLock } = await import('@/lib/gemmie-timer');
        await releaseGemmieLock();
        lockReleased = true;
        console.log('🔓 Released lock in finally block.');
      } catch (releaseError) {
        console.error('❌ Failed to release lock in finally block:', releaseError);
      }
    }
  }
}

export const dynamic = 'force-dynamic';
