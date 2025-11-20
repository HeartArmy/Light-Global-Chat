// Hook for long press detection
export function useLongPress(
  callback: () => void,
  ms: number = 500
): {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
} {
  let timerId: NodeJS.Timeout | null = null;

  const start = () => {
    timerId = setTimeout(callback, ms);
  };

  const clear = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
  };
}

// Hook for swipe detection
export function useSwipe(
  onSwipeRight?: () => void,
  onSwipeLeft?: () => void,
  minSwipeDistance: number = 50,
  maxVerticalMovement: number = 30
): {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
} {
  let touchStartX = 0;
  let touchStartY = 0;
  let isPotentialSwipe = false;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isPotentialSwipe = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isPotentialSwipe) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Reset swipe detection
    isPotentialSwipe = false;

    // Only trigger if horizontal swipe is dominant and meets criteria
    if (Math.abs(deltaX) > minSwipeDistance && 
        Math.abs(deltaY) < maxVerticalMovement && 
        Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}
