import { NextRequest, NextResponse } from 'next/server';
import { getCountryFromIP, getClientIP } from '@/lib/country';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const { countryCode, countryFlag } = await getCountryFromIP(ip);

    return NextResponse.json({
      countryCode,
      countryFlag,
    });
  } catch (error) {
    console.error('Error in country API:', error);
    return NextResponse.json(
      {
        error: 'Failed to determine country',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
