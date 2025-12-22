import { NextRequest, NextResponse } from 'next/server';
import { getGemmieStatus, setGemmieStatus } from '@/lib/gemmie-status';

export const dynamic = 'force-dynamic';

// GET - Get Gemmie status
export async function GET() {
  const enabled = await getGemmieStatus();
  return NextResponse.json({ enabled });
}

// POST - Toggle Gemmie status (only for arham and gemmie)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, enabled } = body;

    console.log('🔧 Gemmie toggle request:', { userName, enabled });

    const success = await setGemmieStatus(enabled, userName);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Unauthorized or failed to update' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({ 
      enabled,
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