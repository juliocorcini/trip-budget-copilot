import { useRef, type TouchEvent } from 'react';

/**
 * G1: lightweight horizontal-swipe detector for "feels native" tab/phase paging.
 *
 * The decision is made on touch-end so we never call preventDefault and never
 * fight the browser's vertical scrolling. A swipe only fires when the gesture is
 * clearly horizontal (dominates the vertical delta) and clears a distance
 * threshold — so a normal vertical scroll or a tap is ignored.
 */
export interface HorizontalSwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

interface UseHorizontalSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal travel (px) for the gesture to count. */
  threshold?: number;
}

export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
}: UseHorizontalSwipeOptions): HorizontalSwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e) => {
      // Multi-touch (pinch) is never a paging swipe.
      const touch = e.touches.length === 1 ? e.touches[0] : undefined;
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    // We only read deltas on end; move is a no-op kept for a stable handler shape.
    onTouchMove: () => {},
    onTouchEnd: (e) => {
      const origin = start.current;
      start.current = null;
      if (!origin) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      // Horizontal must dominate (1.5×) and clear the threshold.
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
  };
}
