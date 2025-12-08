import { NextRequest, NextResponse } from 'next/server';
import { getPusherInstance } from '@/lib/pusher';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import { selectEmojiForMessage, recordGemmieReaction } from '@/lib/gemmie-reactions';
import { default as redis } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    console.log('⏰ Processing delayed emoji reaction...');
    
    const body = await request.json();
    const { messageId, messageContent } = body as { messageId: string; messageContent: string };
    
    console.log(`⏰ Processing delayed emoji reaction for message: ${messageId}`);
    
    // Check if enough time has passed (should be around 30 seconds)
    const lastReactionTime: string | null = await redis.get('gemmie:last-emoji-timestamp');
    const now = Math.floor(Date.now() / 1000);
    
    if (lastReactionTime) {
      const timeSinceLastReaction = now - parseInt(lastReactionTime);
      if (timeSinceLastReaction < 25) { // Minimum 25 seconds between reactions
        console.log('⏰ Too soon for emoji reaction, skipping...');
        return NextResponse.json({ success: false, reason: 'too_soon' });
      }
    }
    
    // Get the message from database
    await connectDB();
    const message = await Message.findById(messageId);
    
    if (!message) {
      console.log('❌ Message not found:', messageId);
      return NextResponse.json({ success: false, reason: 'message_not_found' });
    }
    
    // Check if message already has gemmie reaction
    const hasGemmieReaction = message.reactions.some((r: any) => r.userName === 'gemmie');
    if (hasGemmieReaction) {
      console.log('⏭️ Message already has gemmie reaction:', messageId);
      return NextResponse.json({ success: false, reason: 'already_reacted' });
    }
    
    // Check if user is arham or gemmie (don't react to their messages)
    if (message.userName.toLowerCase() === 'arham' || message.userName.toLowerCase() === 'gemmie') {
      console.log('⏭️ Skipping reaction for arham or gemmie message:', messageId);
      return NextResponse.json({ success: false, reason: 'skip_user' });
    }
    
    // Select emoji for the message
    const emoji = await selectEmojiForMessage(messageContent);
    console.log(`🎭 Selected emoji ${emoji} for message ${messageId}`);
    
    // Add reaction to message
    message.reactions.push({ emoji, userName: 'gemmie' });
    await message.save();
    
    // Record the reaction in Redis
    await recordGemmieReaction(messageId.toString());
    
    // Update last emoji timestamp
    await redis.set('gemmie:last-emoji-timestamp', now.toString());
    
    // Trigger Pusher event for the reaction
    const pusher = getPusherInstance();
    await pusher.trigger('chat-room', 'new-reaction', {
      messageId: messageId.toString(),
      reactions: message.reactions,
    });
    
    console.log(`🎉 Delayed emoji reaction ${emoji} sent for message ${messageId}`);
    
    return NextResponse.json({ 
      success: true, 
      emoji, 
      messageId,
      reactions: message.reactions 
    });
    
  } catch (error) {
    console.error('❌ Error processing delayed emoji reaction:', error);
    return NextResponse.json(
      { error: 'Failed to process delayed emoji reaction', success: false },
      { status: 500 }
    );
  }
}
