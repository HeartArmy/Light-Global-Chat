import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();

    if (!keyword) {
      return NextResponse.json(
        { success: false, error: 'Keyword is required' },
        { status: 400 }
      );
    }

    // Verify keyword against server-side environment variable
    const isValid = keyword === process.env.APP_PASSWORD;

    return NextResponse.json({
      success: isValid,
      error: isValid ? null : 'Incorrect keyword'
    });

  } catch (error) {
    console.error('Keyword verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}