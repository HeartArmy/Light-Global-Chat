import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { getPusherInstance } from '@/lib/pusher';
import { getCountryFromIP, getClientIP } from '@/lib/country';
import { checkRateLimit } from '@/lib/security';
import { sendNewMessageNotification } from '@/lib/email';
import { generateGemmieResponse, sendGemmieMessage } from '@/lib/openrouter';
import { Attachment } from '@/types';

export const dynamic = 'force-dynamic';

// POST - Batch create new messages
export async function POST(request: NextRequest) {
  let messagesPayload: any[] = []; // Initialize messagesPayload
  let userName: string | undefined; // Will be determined from the first message if not provided explicitly
  
  try {
    // Rate limiting (based on the user making the request, not the batch itself)
    const ip = getClientIP(request);
    if (!checkRateLimit(ip, 50, 60000)) { // Allow more for batches
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMIT' },
        { status: 429 }
      );
    }

    const body = await request.json();
    if (body && body.messages) {
        messagesPayload = body.messages;
    }

    if (!messagesPayload || !Array.isArray(messagesPayload) || messagesPayload.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and cannot be empty', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    console.log(`Received batch request for ${messagesPayload.length} messages`);

    // Validate each message in the batch
    const processedMessages = [];
    let hasContentOrAttachments = false;

    for (let i = 0; i < messagesPayload.length; i++) {
      const msg = messagesPayload[i];
      const { content, attachments, userName: msgUserName, replyTo } = msg;

      // Validation - require either content or attachments for each message
      const hasContent = content && typeof content === 'string' && content.trim().length > 0;
      const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
      
      if (i === 0 && !hasContent && !hasAttachments) {
        if (messagesPayload.length > 1) { 
             // Allow if it's the first of multiple messages, but subsequent ones need content/attachments
        } else {
            return NextResponse.json(
                { error: 'Content or attachment is required for the message', code: 'INVALID_INPUT' },
                { status: 400 }
            );
        }
      } else if (!hasContent && !hasAttachments) {
          return NextResponse.json(
              { error: `Message at index ${i} requires content or attachment`, code: 'INVALID_INPUT' },
              { status: 400 }
          );
      }
      
      if (hasContent || hasAttachments) {
          hasContentOrAttachments = true;
      }

      if (content && content.length > 5000) {
        return NextResponse.json(
          { error: `Content in message at index ${i} exceeds 5000 characters`, code: 'INVALID_INPUT' },
          { status: 400 }
        );
      }

      if (!userName && msgUserName) {
        userName = msgUserName;
      }

      if (!msgUserName || typeof msgUserName !== 'string') {
        return NextResponse.json(
          { error: `Username is required for message at index ${i}`, code: 'INVALID_INPUT' },
          { status: 400 }
        );
      }

      if (msgUserName.length > 30) {
        return NextResponse.json(
          { error: `Username in message at index ${i} exceeds 30 characters`, code: 'INVALID_INPUT' },
          { status: 400 }
        );
      }

      // Validate attachments
      if (attachments && attachments.length > 0) {
        if (attachments.length > 8) {
          console.error(`Validation failed: Too many attachments in message at index ${i}`, { attachmentsCount: attachments.length });
          return NextResponse.json(
            { error: `Too many attachments (max 8) in message at index ${i}`, code: 'INVALID_INPUT' },
            { status: 400 }
          );
        }

        for (const attachment of attachments) {
          if (!attachment.url || !attachment.name || !attachment.size || !attachment.type) {
            console.error(`Validation failed: Invalid attachment format in message at index ${i}`, { attachment });
            return NextResponse.json(
              { error: `Invalid attachment format in message at index ${i}`, code: 'INVALID_INPUT' },
              { status: 400 }
            );
          }
          
          if (attachment.type === 'image' && attachment.size > 8 * 1024 * 1024) {
            console.error(`Validation failed: Image size too large in message at index ${i}`, { attachment, maxSize: 8 * 1024 * 1024 });
            return NextResponse.json(
              { error: `Image size exceeds 8MB in message at index ${i}`, code: 'INVALID_INPUT' },
              { status: 400 }
            );
          }
          
          if (attachment.type === 'file' && attachment.size > 16 * 1024 * 1024) {
            console.error(`Validation failed: File size too large in message at index ${i}`, { attachment, maxSize: 16 * 1024 * 1024 });
            return NextResponse.json(
              { error: `File size exceeds 16MB in message at index ${i}`, code: 'INVALID_INPUT' },
              { status: 400 }
            );
          }
        }
      }
      processedMessages.push({ content, attachments, userName: msgUserName, replyTo, timestamp: msg.timestamp || new Date() });
    }

    if (!hasContentOrAttachments) {
        return NextResponse.json(
            { error: 'At least one message in the batch must have content or attachments', code: 'INVALID_INPUT' },
            { status: 400 }
        );
    }

    if (!userName) {
        return NextResponse.json(
            { error: 'Username could not be determined for the batch', code: 'INVALID_INPUT' },
            { status: 400 }
        );
    }


    console.log('Getting country from IP for batch:', ip);
    const { countryCode } = await getCountryFromIP(ip);
    console.log('User country for batch:', countryCode);

    console.log('Connecting to database for batch message creation...');
    await connectDB();
    console.log('Database connected successfully');

    const createdMessages: any[] = []; // Explicitly type
    const pusher = getPusherInstance();

    for (const msgData of processedMessages) {
      console.log(`Creating message for ${msgData.userName} in database...`);
      const messageDoc = await Message.create({
        content: msgData.content || '',
        userName: msgData.userName,
        userCountry: countryCode,
        attachments: msgData.attachments || [],
        replyTo: msgData.replyTo || null,
        timestamp: new Date(msgData.timestamp),
      });
      console.log(`Message created successfully: ${messageDoc._id}`);

      const populatedMessage = await Message.findById(messageDoc._id).populate('replyTo').lean();
      if (populatedMessage) {
        createdMessages.push(populatedMessage);
        console.log(`Triggering Pusher event for message: ${populatedMessage._id}`);
        await pusher.trigger('chat-room', 'new-message', populatedMessage);
      } else {
        console.error(`Failed to populate message: ${messageDoc._id}`);
      }
    }

    console.log('Sending notifications for batched messages...');
    for (const message of createdMessages) {
        if (message && message.userName && message.timestamp && message.userCountry) {
            const emailContent = message.content || `[Attachment: ${message.attachments && Array.isArray(message.attachments) ? message.attachments.map((a: any) => a.name).join(', ') : ''}]`;
            sendNewMessageNotification(message.userName, emailContent, message.timestamp, message.userCountry, ip)
              .catch(err => console.error('Failed to send notification for message:', message._id, err));
        }
    }

    const firstNonSystemMessage = createdMessages.find(m => m && m.userName && m.userName.toLowerCase() !== 'arham' && m.userName.toLowerCase() !== 'gemmie');
    if (firstNonSystemMessage && firstNonSystemMessage.userName && firstNonSystemMessage.content && firstNonSystemMessage.userCountry) {
      console.log(`🤖 Checking if should trigger Gemmie for user: ${firstNonSystemMessage.userName} from batch`);
      const { getGemmieStatus } = await import('@/lib/gemmie-status');
      const isGemmieEnabled = await getGemmieStatus();
      
      if (isGemmieEnabled) {
        console.log(`✅ Triggering Gemmie response for: ${firstNonSystemMessage.userName} based on batch`);
        await triggerGemmieResponse(firstNonSystemMessage.userName, firstNonSystemMessage.content, firstNonSystemMessage.userCountry)
          .catch(err => console.error('❌ Gemmie response failed for batch:', err));
      } else {
        console.log(`🔇 Gemmie is disabled, skipping response for batch`);
      }
    } else {
      console.log('⏭️ Skipping Gemmie response for batch (all messages from arham/gemmie or no suitable message)');
    }

    console.log('Batch message creation completed successfully');
    return NextResponse.json({ 
      messages: createdMessages,
      processedCount: createdMessages.length 
    });

  } catch (error) {
    console.error('Error creating batch messages:', error);
    console.error('Error details:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      messagesPayload: messagesPayload 
    });
    return NextResponse.json(
      { error: 'Failed to create batch messages', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}


async function triggerGemmieResponse(userName: string, userMessage: string, userCountry: string): Promise<void> {
  try {
    console.log('🤖 Starting Gemmie response process for batch message from:', userName);
    
    const delay = 8000 + Math.random() * 8000;
    console.log(`⏰ Waiting ${Math.round(delay)}ms before responding to batch message...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log('🧠 Generating AI response for batch message...');
    const response = await generateGemmieResponse(userName, userMessage, userCountry);
    console.log('💬 Generated response for batch message:', response);
    
    console.log('📤 Sending Gemmie message to chat from batch context...');
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
      editedAt: null
    };
    
    await pusher.trigger('chat-room', 'new-message', gemmieMessage);
    console.log('✅ Gemmie response to batch message complete!');
  } catch (error) {
    console.error('❌ Error in Gemmie response for batch message:', error);
  }
}
