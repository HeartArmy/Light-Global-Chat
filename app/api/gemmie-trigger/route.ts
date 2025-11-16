import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { generateGemmieResponse, sendGemmieMessage } from '@/lib/openrouter';
import { getPusherInstance } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, userCountry } = body;

    if (!userName) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }

    await connectDB();

    const lastResponseTimestamp = await redis.get(`gemmie:last-response-timestamp:${userName}`);

    const query: any = {
      userName,
      timestamp: { $gt: lastResponseTimestamp ? new Date(lastResponseTimestamp as number) : new Date(0) },
    };

    const messages = await Message.find(query).sort({ timestamp: 'asc' }).lean();

    if (messages.length === 0) {
      return NextResponse.json({ message: 'No new messages to process' });
    }

    const latestMessageTimestamp = messages[messages.length - 1].timestamp;
    const context = messages.map((m) => m.content).join('\n');

    const response = await generateGemmieResponse(userName, context, userCountry);

    await sendGemmieMessage(response);

    const pusher = getPusherInstance();
    const gemmieMessage = {
      _id: new Date().getTime().toString(),
      content: response,
      userName: 'gemmie',
      userCountry: 'US',
      timestamp: new Date(),
      attachments: [],
      replyTo: null,
      reactions: [],
      edited: false,
      editedAt: null,
    };
    await pusher.trigger('chat-room', 'new-message', gemmieMessage);

    await redis.set(`gemmie:last-response-timestamp:${userName}`, latestMessageTimestamp.getTime());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in Gemmie trigger:', error);
    return NextResponse.json({ error: 'Failed to trigger Gemmie' }, { status: 500 });
  }
}
