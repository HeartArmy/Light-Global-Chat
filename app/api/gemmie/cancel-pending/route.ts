import { NextRequest, NextResponse } from 'next/server';
import { cancelPendingGemmieJobs } from '@/lib/gemmie-timer';

export async function POST(request: NextRequest) {
  try {
    // Cancel any pending QStash jobs
    await cancelPendingGemmieJobs();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cancelled any pending Gemmie jobs' 
    });
  } catch (error) {
    console.error('Error cancelling pending jobs:', error);
    return NextResponse.json(
      { error: 'Failed to cancel pending jobs', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';