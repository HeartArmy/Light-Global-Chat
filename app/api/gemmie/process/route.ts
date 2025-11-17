import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { generateGemmieResponse, sendGemmieMessage } from '@/lib/openrouter';
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

  try {
    // Parse the request body
    const { userName, userMessage, userCountry } = JSON.parse(body);

    console.log('🤖 Starting delayed Gemmie response process for:', userName);

    // Generate response
    console.log('🧠 Generating AI response...');
    const response = await generateGemmieResponse(userName, userMessage, userCountry);
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
  }
}

export const dynamic = 'force-dynamic';
