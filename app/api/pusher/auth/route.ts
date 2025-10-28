import { NextRequest, NextResponse } from 'next/server';
import { getPusherInstance } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { socket_id, channel_name } = body;

    console.log('Pusher auth request:', { socket_id, channel_name });

    // Only allow presence channel authentication
    if (!channel_name.startsWith('presence-')) {
      console.error('Invalid channel name:', channel_name);
      return NextResponse.json(
        { error: 'Invalid channel' },
        { status: 403 }
      );
    }

    const pusher = getPusherInstance();
    
    // Authenticate the user for the presence channel
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
      user_id: socket_id, // Use socket_id as unique user identifier
      user_info: {
        // You can add more user info here if needed
      },
    });

    console.log('Pusher auth successful');
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
