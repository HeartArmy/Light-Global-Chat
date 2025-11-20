import ChatRoomClient from '@/components/ChatRoomClient';
import { ThemeProvider } from '@/components/ThemeProvider';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ThemeProvider>
      <ChatRoomClient />
    </ThemeProvider>
  );
}
