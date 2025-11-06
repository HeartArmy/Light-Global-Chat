import { NextRequest, NextResponse } from 'next/server';
// Previously this endpoint re-enabled Gemmie when arham disconnected.
// To persist arham's preference, we no longer change Gemmie state here.

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

    console.log('👋 Arham disconnected — no Gemmie state change (preference persists).');
    return NextResponse.json({ message: 'Arham disconnected (no change to Gemmie)' });
  } catch (error) {
    console.error('Error handling arham disconnect:', error);
    return NextResponse.json(
      { error: 'Failed to handle disconnect' },
      { status: 500 }
    );
  }
}