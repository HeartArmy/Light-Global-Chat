import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { getPusherInstance } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, emoji, userName, action } = body;

    // Validation
    if (!messageId || !emoji || !userName || !action) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json(
        { error: 'Action must be "add" or "remove"', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find message
    const message = await Message.findById(messageId);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Handle reaction
    if (action === 'add') {
      // Check if user already reacted with this emoji
      const existingReaction = message.reactions.find(
        (r: any) => r.emoji === emoji && r.userName === userName
      );

      if (!existingReaction) {
        message.reactions.push({ emoji, userName });
      }
    } else {
      // Remove reaction
      message.reactions = message.reactions.filter(
        (r: any) => !(r.emoji === emoji && r.userName === userName)
      );
    }

    await message.save();

    // Trigger Pusher event
    const pusher = getPusherInstance();
    await pusher.trigger('chat-room', 'new-reaction', {
      messageId,
      reactions: message.reactions,
    });

    return NextResponse.json({ reactions: message.reactions });
  } catch (error) {
    console.error('Error handling reaction:', error);
    return NextResponse.json(
      { error: 'Failed to handle reaction', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
