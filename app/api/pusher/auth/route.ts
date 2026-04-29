import { NextRequest, NextResponse } from 'next/server';
import { getPusherInstance } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    // Pusher sends form-encoded data, not JSON
    const formData = await request.formData();
    const socket_id = formData.get('socket_id') as string;
    const channel_name = formData.get('channel_name') as string;
    const user_id =
      (formData.get('user_id') as string) ||
      (formData.get('auth[user_id]') as string) ||
      socket_id;

    // console.log('Pusher auth request:', { socket_id, channel_name, user_id });

    if (!socket_id || !channel_name) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

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
    const authResponse = pusher.authenticate(socket_id, channel_name, {
      user_id,
      user_info: {
        // You can add more user info here if needed
      },
    });

    // console.log('Pusher auth successful');
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
