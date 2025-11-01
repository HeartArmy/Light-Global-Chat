import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { getPusherInstance } from '@/lib/pusher';
import { getCountryFromIP, getClientIP } from '@/lib/country';
import { checkRateLimit } from '@/lib/security';
import { sendNewMessageNotification } from '@/lib/email';
import { generateGemmieResponse, sendGemmieMessage } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

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

    console.log('Received message request:', { content, contentLength: content?.length, attachmentsCount: attachments?.length, userName });

    // Validation - require either content or attachments
    const hasContent = content && typeof content === 'string' && content.trim().length > 0;
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
    
    console.log('Validation:', { hasContent, hasAttachments });
    
    if (!hasContent && !hasAttachments) {
      console.error('Validation failed: no content or attachments');
      return NextResponse.json(
        { error: 'Content or attachment is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    if (content && content.length > 5000) {
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
      content: content || '',
      userName,
      userCountry: countryCode,
      attachments,
      replyTo: replyTo || null,
      timestamp: new Date(),
    });

    // Populate replyTo if it exists
    const populatedMessage = await Message.findById(message._id).populate('replyTo').lean();

    // Trigger Pusher event and send notifications in parallel
    const pusher = getPusherInstance();
    const emailContent = content || `[Attachment: ${attachments.map((a: any) => a.name).join(', ')}]`;
    
    // Run Pusher and notifications in parallel, but wait for both
    await Promise.allSettled([
      pusher.trigger('chat-room', 'new-message', populatedMessage),
      sendNewMessageNotification(userName, emailContent, message.timestamp, countryCode)
    ]);

    // If message is from someone other than arham or gemmie, trigger Gemmie response
    console.log('🤖 Checking if should trigger Gemmie for user:', userName);
    if (userName.toLowerCase() !== 'arham' && userName.toLowerCase() !== 'gemmie') {
      console.log('✅ Triggering Gemmie response for:', userName);
      // Wait for Gemmie response to complete (prevents serverless function from dying)
      await triggerGemmieResponse(userName, content || '[attachment]', countryCode).catch(err =>
        console.error('❌ Gemmie response failed:', err)
      );
    } else {
      console.log('⏭️ Skipping Gemmie response (user is arham or gemmie)');
    }

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

// Trigger Gemmie's AI response
async function triggerGemmieResponse(userName: string, userMessage: string, userCountry: string): Promise<void> {
  try {
    console.log('🤖 Starting Gemmie response process for:', userName);
    
    // Wait a bit to seem more natural (1-3 seconds)
    const delay = 3000 + Math.random() * 5000;
    console.log(`⏰ Waiting ${Math.round(delay)}ms before responding...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
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
    console.log('✅ Gemmie response complete!');
  } catch (error) {
    console.error('❌ Error in Gemmie response:', error);
  }
}