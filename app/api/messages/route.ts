import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { getPusherInstance } from '@/lib/pusher';
import { getCountryFromIP, getClientIP } from '@/lib/country';
import { checkRateLimit } from '@/lib/security';
import { sendNewMessageNotification } from '@/lib/email';
import redis from '@/lib/redis'; // Import redis
import { shouldGemmieReact, selectEmojiForMessage, recordGemmieReaction } from '@/lib/gemmie-reactions';
import { Attachment } from '@/types';
import Log from '@/models/Log';

export const dynamic = 'force-dynamic';

// POST - Create new message
export async function POST(request: NextRequest) {
  let content: string | undefined;
  let userName: string | undefined;
  let attachments: Attachment[] = [];
  let replyTo: string | undefined;
  
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
    ({ content, userName, attachments, replyTo } = body);

    console.log('Received message request:', { 
      content, 
      contentLength: content?.length, 
      attachmentsCount: attachments?.length, 
      userName,
      videoAttachments: attachments.filter((a: Attachment) => a.type === 'video').map((a: Attachment) => ({ name: a.name, size: a.size }))
    });

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
      // Limit total number of attachments
      if (attachments.length > 8) {
        console.error('Validation failed: Too many attachments', { attachmentsCount: attachments.length });
        return NextResponse.json(
          { error: 'Too many attachments (max 8)', code: 'INVALID_INPUT' },
          { status: 400 }
        );
      }

      for (const attachment of attachments) {
        console.log('Validating attachment:', { name: attachment.name, type: attachment.type, size: attachment.size, url: attachment.url });
        if (!attachment.url || !attachment.name || !attachment.size || !attachment.type) {
          console.error('Validation failed: Invalid attachment format', { attachment });
          return NextResponse.json(
            { error: 'Invalid attachment format', code: 'INVALID_INPUT' },
            { status: 400 }
          );
        }
        
        // Validate file sizes
        if (attachment.type === 'image' && attachment.size > 8 * 1024 * 1024) {
          console.error('Validation failed: Image size too large', { attachment, maxSize: 8 * 1024 * 1024 });
          return NextResponse.json(
            { error: 'Image size exceeds 8MB', code: 'INVALID_INPUT' },
            { status: 400 }
          );
        }
        
        if (attachment.type === 'file' && attachment.size > 16 * 1024 * 1024) {
          console.error('Validation failed: File size too large', { attachment, maxSize: 16 * 1024 * 1024 });
          return NextResponse.json(
            { error: 'File size exceeds 16MB', code: 'INVALID_INPUT' },
            { status: 400 }
          );
        }
      }
    }

    // Get user country from IP (reuse ip from rate limiting)
    console.log('Getting country from IP:', ip);
    const { countryCode } = await getCountryFromIP(ip);
    console.log('User country:', countryCode);

    // Connect to database
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    // Create message
    console.log('Creating message in database...');
    const message = await Message.create({
      content: content || '',
      userName,
      userCountry: userName.toLowerCase() === 'gemmie' ? 'US' : countryCode,
      attachments,
      replyTo: replyTo || null,
      timestamp: new Date(),
    });
    console.log('Message created successfully:', { _id: message._id });

    // Populate replyTo if it exists
    console.log('Populating replyTo...');
    const populatedMessage = await Message.findById(message._id).populate('replyTo').lean();
    console.log('ReplyTo populated successfully');

    // Check if Gemmie should react with an emoji first (before any other processing)
    const messageContent = content || `[Attachment: ${attachments.map((a: any) => a.name).join(', ')}]`;
    
    if (populatedMessage && userName.toLowerCase() !== 'arham' && userName.toLowerCase() !== 'gemmie') {
      // Check if Gemmie should react with an emoji
      const shouldReact = await shouldGemmieReact(message._id.toString());
      if (shouldReact) {
        console.log(`⏰ Gemmie will react to message ${message._id} in 30 seconds...`);
        
        // Schedule delayed emoji reaction using QStash
        try {
          const qstash = await import('@/lib/qstash');
          
          // Get the absolute URL for the delayed emoji processing endpoint
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          const emojiEndpoint = `${baseUrl}/api/emoji-delayed-process`;
          console.log('⏰ QStash emoji target endpoint:', emojiEndpoint);
          
          const emojiPayload = {
            messageId: message._id.toString(),
            messageContent: messageContent
          };
          console.log('⏰ QStash emoji payload:', JSON.stringify(emojiPayload));
          
          // Schedule emoji reaction with 30 second delay
          const emojiResponse = await qstash.default.publishJSON({
            url: emojiEndpoint,
            body: emojiPayload,
            delay: 30, // 30 second delay
          });
          console.log('⏰ QStash emoji publish successful. Response:', emojiResponse);
          
        } catch (qstashError) {
          console.error('❌ QStash emoji publish failed:', qstashError);
          // Fallback to immediate reaction if QStash fails
          try {
            const emoji = await selectEmojiForMessage(messageContent);
            console.log(`🤖 Fallback: Gemmie reacting with emoji: ${emoji} to message ${message._id}`);
            
            // Add the reaction to the message
            populatedMessage.reactions.push({ emoji, userName: 'gemmie' });
            
            // Update the message in database with the reaction
            await Message.findByIdAndUpdate(message._id, {
              reactions: populatedMessage.reactions
            });
            
            // Record that Gemmie has reacted
            await recordGemmieReaction(message._id.toString());
            
            // Trigger Pusher event for the reaction
            const pusher = getPusherInstance();
            await pusher.trigger('chat-room', 'new-reaction', {
              messageId: message._id.toString(),
              reactions: populatedMessage.reactions,
            });
            
            console.log(`🎉 Fallback: Gemmie reaction ${emoji} sent for message ${message._id}`);
          } catch (fallbackError) {
            console.error('❌ Fallback emoji reaction also failed:', fallbackError);
          }
        }
      }
    }

    // Trigger Pusher event and send notifications in parallel
    console.log('Triggering Pusher event and sending notifications...');
    const pusher = getPusherInstance();
    const emailContent = content || `[Attachment: ${attachments.map((a: any) => a.name).join(', ')}]`;
    
    // Run Pusher and notifications in parallel, but wait for both
    await Promise.allSettled([
      pusher.trigger('chat-room', 'new-message', populatedMessage),
      sendNewMessageNotification(userName, emailContent, message.timestamp, countryCode, ip)
    ]);
    console.log('Pusher event and notifications completed');

    // Check for voice commands from arham to disable/enable Gemmie
    if (userName.toLowerCase() === 'arham' && content) {
      const trimmedContent = content.trim().toLowerCase();
      
      if (trimmedContent === 'freeze all motor functions') {
        console.log('🚨 Voice command detected: Disabling Gemmie');
        
        try {
          const { setGemmieStatus } = await import('@/lib/gemmie-status');
          const success = await setGemmieStatus(false, userName);
          
          if (success) {
            // Trigger Pusher event to update UI
            const pusher = getPusherInstance();
            await pusher.trigger('chat-room', 'gemmie-status-changed', { enabled: false });
            
            console.log('✅ Gemmie disabled via voice command');
          }
        } catch (error) {
          console.error('❌ Failed to disable Gemmie via voice command:', error);
        }
      } else if (trimmedContent === 'resume') {
        console.log('🚀 Voice command detected: Enabling Gemmie');
        
        try {
          const { setGemmieStatus } = await import('@/lib/gemmie-status');
          const success = await setGemmieStatus(true, userName);
          
          if (success) {
            // Trigger Pusher event to update UI
            const pusher = getPusherInstance();
            await pusher.trigger('chat-room', 'gemmie-status-changed', { enabled: true });
            
            console.log('✅ Gemmie enabled via voice command');
          }
        } catch (error) {
          console.error('❌ Failed to enable Gemmie via voice command:', error);
        }
      }
    }

    // If message is from someone other than arham or gemmie, check if should trigger Gemmie response
    console.log('🤖 Checking if should trigger Gemmie for user:', userName);
    if (userName.toLowerCase() !== 'arham' && userName.toLowerCase() !== 'gemmie') {
      const { getGemmieStatus } = await import('@/lib/gemmie-status');
      const isGemmieEnabled = await getGemmieStatus();

      if (isGemmieEnabled) {
        console.log('✅ Scheduling delayed Gemmie response for:', userName);

        // Use delayed processing with timer reset functionality
        const { resetGemmieTimer, queueGemmieMessage, setJobActive, setSelectedImageUrl, scheduleGemmieTypingIndicator } = await import('@/lib/gemmie-timer');
        
        // Try to set job active (prevents multiple QStash jobs)
        const jobSet = await setJobActive();
        if (jobSet) {
          // If job set active, reset the timer (which will schedule a new QStash job)
          await resetGemmieTimer(userName, content || '[attachment]', countryCode);
          
          // Schedule Gemmie typing indicator after delay
          scheduleGemmieTypingIndicator(userName, content || '[attachment]', countryCode);
          
          // Store the first image URL for AI processing if available (do this AFTER resetGemmieTimer)
          const firstImage = attachments.find(attachment => attachment.type === 'image');
          if (firstImage) {
            console.log('📸 Storing selected image URL for AI processing:', firstImage.url);
            await setSelectedImageUrl(firstImage.url);
          }
        } else {
          // If job already active, queue this message
          await queueGemmieMessage(userName, content || '[attachment]', countryCode);
          console.log('📝 Message queued as a Gemmie job is already active.');
          
          // Store the first image URL for AI processing if available
          const firstImage = attachments.find(attachment => attachment.type === 'image');
          if (firstImage) {
            console.log('📸 Storing selected image URL for AI processing:', firstImage.url);
            await setSelectedImageUrl(firstImage.url);
          }
        }
      } else {
        console.log('🔇 Gemmie is disabled, skipping response');
      }
    } else {
      console.log('⏭️ Skipping Gemmie response (user is arham or gemmie)');
    }

    // Save message creation to MongoDB logs
    const logEntry = new Log({
      level: 'info',
      message: `Message created: ${message._id}`,
      meta: {
        messageId: message._id.toString(),
        userName,
        userCountry: countryCode,
        content: content || '[attachment]',
        attachmentsCount: attachments.length,
        timestamp: new Date(),
      },
      route: '/api/messages',
    });

    await logEntry.save();

    console.log('Message creation completed successfully');
    return NextResponse.json({ message: populatedMessage });
  } catch (error) {
    console.error('Error creating message:', error);
    console.error('Error details:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      attachments: attachments.map((a: Attachment) => ({ type: a.type, name: a.name, size: a.size })),
      userName,
      contentLength: content?.length
    });
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
    const limit = parseInt(searchParams.get('limit') || '500');
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

// PUT - Edit message
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, newContent, userName } = body;

    if (!messageId || !newContent || !userName) {
      return NextResponse.json(
        { error: 'Message ID, new content, and username are required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    await connectDB();

    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Allow editing if user is arham or gemmie, or if message is from the user and within 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const isAuthorizedUser = ['arham', 'gemmie'].includes(userName.toLowerCase()) || 
                             (message.userName === userName && message.timestamp > tenMinutesAgo);

    if (!isAuthorizedUser) {
      return NextResponse.json(
        { error: 'Not authorized to edit this message', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    message.content = newContent;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    const updatedMessage = await Message.findById(messageId).populate('replyTo').lean();

    // Trigger Pusher event for real-time update
    const pusher = getPusherInstance();
    await pusher.trigger('chat-room', 'message-edited', updatedMessage);

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
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const userName = searchParams.get('userName');

    if (!messageId || !userName) {
      return NextResponse.json(
        { error: 'Message ID and username are required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    await connectDB();

    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Allow deleting if user is arham or gemmie, or if message is from the user and within 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const isAuthorizedUser = ['arham', 'gemmie'].includes(userName.toLowerCase()) ||
                             (message.userName === userName && message.timestamp > tenMinutesAgo);

    if (!isAuthorizedUser) {
      return NextResponse.json(
        { error: 'Not authorized to delete this message', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // Save deleted message to MongoDB logs
    const logEntry = new Log({
      level: 'info',
      message: `Message deleted: ${messageId}`,
      meta: {
        messageId: messageId,
        userName: userName,
        userCountry: message.userCountry,
        originalContent: message.content,
        timestamp: new Date(),
      },
      route: '/api/messages',
    });

    await logEntry.save();

    await Message.findByIdAndDelete(messageId);

    // Trigger Pusher event for real-time update
    const pusher = getPusherInstance();
    await pusher.trigger('chat-room', 'message-deleted', { messageId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
