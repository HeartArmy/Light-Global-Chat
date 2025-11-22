'use client';

import ChatRoomClient from '@/components/ChatRoomClient';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useEffect } from 'react';

export const dynamic = 'force-dynamic';

export default function Page() {
  useEffect(() => {
    // Create falling snow effect
    const createSnowflake = () => {
      const snowflake = document.createElement('div');
      snowflake.className = 'snowflake';
      snowflake.textContent = '❄';
      snowflake.style.left = `${Math.random() * 100}vw`;
      snowflake.style.animationDuration = `${Math.random() * 3 + 2}s`;
      snowflake.style.opacity = `${Math.random() * 0.7 + 0.3}`;
      
      document.body.appendChild(snowflake);
      
      // Remove snowflake after animation
      setTimeout(() => {
        snowflake.remove();
      }, 5000);
    };

    // Create Christmas lights effect
    const createChristmasLights = (): (() => void) => {
      const lightsContainer = document.createElement('div');
      lightsContainer.className = 'christmas-lights';
      
      // Create multiple lights
      for (let i = 0; i < 50; i++) {
        const light = document.createElement('div');
        light.className = 'christmas-light';
        light.style.left = `${i * 2}vw`;
        lightsContainer.appendChild(light);
      }
      
      document.body.appendChild(lightsContainer);
      
      return (): void => lightsContainer.remove();
    };

    // Start snow effect (limited to avoid performance issues)
    const snowInterval = setInterval(() => {
      if (document.querySelectorAll('.snowflake').length < 20) {
        createSnowflake();
      }
    }, 800);

    // Add Christmas lights
    const removeLights = createChristmasLights();

    return () => {
      clearInterval(snowInterval);
      removeLights?.();
      // Clean up any remaining snowflakes
      document.querySelectorAll('.snowflake').forEach(el => el.remove());
    };
  }, []);

  return (
    <ThemeProvider>
      <ChatRoomClient />
    </ThemeProvider>
  );
}
