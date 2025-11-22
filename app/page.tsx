import ChatRoomClient from '@/components/ChatRoomClient';
import { ThemeProvider } from '@/components/ThemeProvider';
import ChristmasEffects from '@/components/ChristmasEffects';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <ThemeProvider>
      <ChristmasEffects />
      <ChatRoomClient />
    </ThemeProvider>
  );
}
