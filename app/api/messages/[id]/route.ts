import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { getPusherInstance } from '@/lib/pusher';

export const dynamic = 'force-dynamic';

const TEN_MINUTES = 10 * 60 * 1000;

// PATCH - Edit message
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { content, userName } = body;

    // Validation
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Content exceeds 5000 characters', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    if (!userName) {
      return NextResponse.json(
        { error: 'Username is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find message
    const message = await Message.findById(id);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const isPrivileged = ['arham', 'gemmie'].includes(userName.toLowerCase());

    // Verify ownership or privileged
    if (message.userName !== userName && !isPrivileged) {
      return NextResponse.json(
        { error: 'Unauthorized to edit this message', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // Check time limit only for non-privileged owners
    const messageAge = Date.now() - new Date(message.timestamp).getTime();
    if (!isPrivileged && message.userName === userName && messageAge > TEN_MINUTES) {
      return NextResponse.json(
        { error: 'Edit window expired (10 minutes)', code: 'EDIT_EXPIRED' },
        { status: 403 }
      );
    }

    // Update message
    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    const updatedMessage = await Message.findById(id).populate('replyTo').lean();

    // Trigger Pusher event
    const pusher = getPusherInstance();
    await pusher.trigger('chat-room', 'update-message', {
      messageId: id,
      content,
      edited: true,
      editedAt: message.editedAt,
    });

    return NextResponse.json({ message: updatedMessage });
  } catch (error) {
    console.error('Error editing message:', error);
    return NextResponse.json(
      { error: 'Failed to edit message', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE - Delete message
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { userName } = body;

    if (!userName) {
      return NextResponse.json(
        { error: 'Username is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find message
    const message = await Message.findById(id);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const isPrivileged = ['arham', 'gemmie'].includes(userName.toLowerCase());

    // Verify ownership or privileged
    if (message.userName !== userName && !isPrivileged) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this message', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // Check time limit only for non-privileged owners
    const messageAge = Date.now() - new Date(message.timestamp).getTime();
    if (!isPrivileged && message.userName === userName && messageAge > TEN_MINUTES) {
      return NextResponse.json(
        { error: 'Delete window expired (10 minutes)', code: 'EDIT_EXPIRED' },
        { status: 403 }
      );
    }

    // Delete message
    await Message.findByIdAndDelete(id);

    // Trigger Pusher event
    const pusher = getPusherInstance();
    await pusher.trigger('chat-room', 'delete-message', {
      messageId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
