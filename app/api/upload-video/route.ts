import { NextResponse } from 'next/server';
import { uploadVideoToSupabase, MAX_VIDEO_SIZE, SUPPORTED_VIDEO_FORMATS } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!SUPPORTED_VIDEO_FORMATS.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported video format: ${file.type}. Supported formats: ${SUPPORTED_VIDEO_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: `Video file too large. Maximum size is ${MAX_VIDEO_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Upload to Supabase
    const { url, path } = await uploadVideoToSupabase(file);

    return NextResponse.json(
      { 
        success: true, 
        url, 
        path,
        name: file.name,
        size: file.size,
        type: file.type 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to upload video',
        success: false 
      },
      { status: 500 }
    );
  }
}

// Allow GET for CORS preflight
export async function GET() {
  return NextResponse.json(
    { message: 'Video upload endpoint. Use POST to upload videos.' },
    { status: 200 }
  );
}

// Configure CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}