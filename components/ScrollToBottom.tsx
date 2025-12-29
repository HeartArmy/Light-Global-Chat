'use client';

import { useState, useEffect, useCallback } from 'react';

interface ScrollToBottomProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function ScrollToBottom({ containerRef }: ScrollToBottomProps) {
  const [isVisible, setIsVisible] = useState(false);

  const checkScrollPosition = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Show arrow when scrolled up more than 200px from bottom
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 200;
    setIsVisible(isFarFromBottom);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial check
    checkScrollPosition();

    // Add scroll event listener
    container.addEventListener('scroll', checkScrollPosition);
    
    // Check periodically to catch any programmatic scrolls (like scrollToMessage)
    const interval = setInterval(checkScrollPosition, 100);

    // Also check after a short delay to catch any delayed scroll operations
    const timeoutId = setTimeout(checkScrollPosition, 500);

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [containerRef, checkScrollPosition]);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToBottom}
      className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-40 p-2.5 rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        background: 'var(--accent)',
        color: '#ffffff',
        border: '1px solid var(--border)',
        // Ensure it's above other content
        willChange: 'transform',
        // Subtle pulse animation to attract attention
        animation: 'pulse 2s infinite',
      }}
      title="Scroll to latest message"
      aria-label="Scroll to latest message"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}