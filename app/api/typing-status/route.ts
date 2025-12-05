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

export const dynamic = 'force-dynamic';