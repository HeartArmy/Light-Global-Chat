import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';

const TYPING_INDICATOR_KEY = 'typing:indicator';

export async function GET() {
  try {
    const typingStatus = await redis.get(TYPING_INDICATOR_KEY);
    return NextResponse.json({ isTyping: typingStatus === 'typing' });
  } catch (error) {
    console.error('Error checking typing status:', error);
    return NextResponse.json({ isTyping: false }, { status: 500 });
  }
}

// POST - Set typing indicator
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { isTyping } = body;
    
    if (typeof isTyping !== 'boolean') {
      return NextResponse.json({ error: 'isTyping must be a boolean' }, { status: 400 });
    }
    
    const { setTypingIndicator } = await import('@/lib/gemmie-timer');
    await setTypingIndicator(isTyping);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting typing status:', error);
    return NextResponse.json({ error: 'Failed to set typing status' }, { status: 500 });
  }
}

// DELETE - Clear typing indicator
export async function DELETE() {
  try {
    const { setTypingIndicator } = await import('@/lib/gemmie-timer');
    await setTypingIndicator(false);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing typing status:', error);
    return NextResponse.json({ error: 'Failed to clear typing status' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';