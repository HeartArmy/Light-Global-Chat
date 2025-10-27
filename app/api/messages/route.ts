import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { getPusherInstance } from '@/lib/pusher';
import { getCountryFromIP, getClientIP } from '@/lib/country';
import { checkRateLimit } from '@/lib/security';

// POST - Create new message
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIP(request);
    if (!checkRateLimit(ip, 10, 60000)) {
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMIT' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { content, userName, attachments = [], replyTo } = body;

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

    if (!userName || typeof userName !== 'string') {
      return NextResponse.json(
        { error: 'Username is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    if (userName.length > 30) {
      return NextResponse.json(
        { error: 'Username exceeds 30 characters', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // Validate attachments
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        if (!attachment.url || !attachment.name || !attachment.size || !attachment.type) {
          return NextResponse.json(
            { error: 'Invalid attachment format', code: 'INVALID_INPUT' },
            { status: 400 }
          );
        }
        
        // Validate file sizes
        if (attachment.type === 'image' && attachment.size > 8 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'Image size exceeds 8MB', code: 'INVALID_INPUT' },
            { status: 400 }
          );
        }
        
        if (attachment.type === 'file' && attachment.size > 16 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'File size exceeds 16MB', code: 'INVALID_INPUT' },
            { status: 400 }
          );
        }
      }
    }

    // Get user country from IP (reuse ip from rate limiting)
    const { countryCode } = await getCountryFromIP(ip);

    // Connect to database
    await connectDB();

    // Create message
    const message = await Message.create({
      content,
      userName,
      userCountry: countryCode,
      attachments,
      replyTo: replyTo || null,
      timestamp: new Date(),
    });

    // Populate replyTo if it exists
    const populatedMessage = await Message.findById(message._id).populate('replyTo').lean();

    // Trigger Pusher event
    const pusher = getPusherInstance();
    await pusher.trigger('chat-room', 'new-message', populatedMessage);

    return NextResponse.json({ message: populatedMessage });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

// GET - Fetch messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    await connectDB();

    const query: any = {};
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(limit + 1)
      .populate('replyTo')
      .lean();

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    return NextResponse.json({
      messages: resultMessages,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
