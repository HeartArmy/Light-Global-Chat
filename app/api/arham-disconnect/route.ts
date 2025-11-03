import { NextRequest, NextResponse } from 'next/server';
import { setGemmieStatus } from '@/lib/gemmie-status';

export const dynamic = 'force-dynamic';

// POST - Handle arham disconnect and re-enable Gemmie
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName } = body;

    // Only process if it's arham disconnecting
    if (userName !== 'arham') {
      return NextResponse.json({ message: 'Not arham' });
    }

    console.log('👋 Arham disconnected, re-enabling Gemmie...');
    
    // Re-enable Gemmie when arham leaves
    const success = await setGemmieStatus(true, 'arham');
    
    if (success) {
      console.log('✅ Gemmie automatically re-enabled after arham left');
      return NextResponse.json({ 
        message: 'Gemmie re-enabled',
        enabled: true 
      });
    } else {
      console.log('❌ Failed to re-enable Gemmie');
      return NextResponse.json({ 
        message: 'Failed to re-enable Gemmie' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error handling arham disconnect:', error);
    return NextResponse.json(
      { error: 'Failed to handle disconnect' },
      { status: 500 }
    );
  }
}