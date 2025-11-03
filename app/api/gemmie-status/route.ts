import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for Gemmie status (in production, you'd use a database)
let gemmieEnabled = true;

export const dynamic = 'force-dynamic';

// GET - Get Gemmie status
export async function GET() {
  return NextResponse.json({ enabled: gemmieEnabled });
}

// POST - Toggle Gemmie status (only for arham)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, enabled } = body;

    // Only allow arham to control Gemmie
    if (userName !== 'arham') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    gemmieEnabled = enabled;
    
    return NextResponse.json({ 
      enabled: gemmieEnabled,
      message: `Gemmie ${enabled ? 'enabled' : 'disabled'}` 
    });
  } catch (error) {
    console.error('Error updating Gemmie status:', error);
    return NextResponse.json(
      { error: 'Failed to update Gemmie status' },
      { status: 500 }
    );
  }
}