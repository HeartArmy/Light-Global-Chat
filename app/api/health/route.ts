import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// Health check endpoint to keep MongoDB and serverless warm
export async function GET() {
  try {
    // Ping MongoDB to keep it awake
    await connectDB();
    
    return NextResponse.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Server and database are warm'
    });
  } catch (error) {
    return NextResponse.json({ 
      status: 'error',
      error: 'Database connection failed'
    }, { status: 500 });
  }
}
