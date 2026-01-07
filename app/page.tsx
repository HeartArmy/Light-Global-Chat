import ChatRoomClient from '@/components/ChatRoomClient';
import { ThemeProvider } from '@/components/ThemeProvider';
import ChristmasEffects from '@/components/ChristmasEffects';

export const dynamic = 'force-dynamic';

export default function Page() {
  // Check if current date is between December 15th and 31st
  const isChristmasSeason = (): boolean => {
    const now = new Date();
    const month = now.getMonth(); // 0-11 (January = 0, December = 11)
    const day = now.getDate();
    
    // Only activate during December 15-31
    return month === 11 && day >= 15 && day <= 31;
  };

  return (
    <ThemeProvider>
      {isChristmasSeason() && <ChristmasEffects />}
      <ChatRoomClient />
    </ThemeProvider>
  );
}
