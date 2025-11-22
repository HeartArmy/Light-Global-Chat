'use client';

import { useEffect } from 'react';

export default function ChristmasEffects() {
  useEffect(() => {
    // Create falling snow effect
    const createSnowflake = () => {
      const snowflake = document.createElement('div');
      snowflake.className = 'snowflake';
      snowflake.textContent = '❄';
      snowflake.style.left = `${Math.random() * 100}vw`;
      snowflake.style.animationDuration = `${Math.random() * 3 + 2}s`;
      snowflake.style.opacity = `${Math.random() * 0.3 + 0.3}`;
      
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
      
      const numLights = window.innerWidth < 768 ? 40 : 100;
      for (let i = 0; i < numLights; i++) {
        const light = document.createElement('div');
        light.className = 'christmas-light';
        const leftPos = (i / (numLights - 1)) * 100;
        const topPos = (window.innerWidth < 768 ? 10 : 18) + Math.sin(i * 0.12) * (window.innerWidth < 768 ? 8 : 16);
        light.style.left = `${leftPos}%`;
        light.style.top = `${topPos}px`;
        lightsContainer.appendChild(light);
      }
      
      document.body.appendChild(lightsContainer);
      
      return (): void => lightsContainer.remove();
    };

    // Start snow effect (limited to avoid performance issues)
    const snowInterval = setInterval(() => {
      if (document.querySelectorAll('.snowflake').length < 10 && Math.random() < 0.2) {
        createSnowflake();
      }
    }, 1600);
  
    // Christmas popup items
    const christmasItems = ['🎄', '⛄', '🍪', '🕊️', '🦌', '🎅', '🎁', '🌟'];
    
    const createPopup = () => {
      const isMobile = window.innerWidth < 768;
      if (document.querySelectorAll('.christmas-popup').length >= (isMobile ? 4 : 3) || Math.random() >= (isMobile ? 0.90 : 0.90)) return;
      
      const popup = document.createElement('div');
      popup.className = 'christmas-popup';
      popup.textContent = christmasItems[Math.floor(Math.random() * christmasItems.length)];
      popup.style.left = `${Math.random() * 85 + 5}%`;
      popup.style.bottom = `${Math.random() * 60 + 5}%`;
      popup.style.animationDuration = `${3 + Math.random() * 2}s`;
      popup.style.animationDelay = `${Math.random() * 1}s`;
      
      document.body.appendChild(popup);
      
      setTimeout(() => {
        popup.remove();
      }, 6000);
    };
  
    const popupInterval = setInterval(createPopup, 5000);
  
    // Add Christmas lights
    const removeLights = createChristmasLights();

    return () => {
      clearInterval(snowInterval);
      clearInterval(popupInterval);
      removeLights?.();
      // Clean up any remaining elements
      document.querySelectorAll('.snowflake').forEach(el => el.remove());
      document.querySelectorAll('.christmas-popup').forEach(el => el.remove());
    };
  }, []);

  return null; // This component doesn't render anything visible
}
