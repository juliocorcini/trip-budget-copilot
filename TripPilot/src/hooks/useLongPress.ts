import { useRef, useCallback } from 'react';
import { hapticImpact } from '@/utils/haptics';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 12;

export interface LongPressBinding {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClickCapture: (e: React.MouseEvent) => void;
}

/**
 * DEC-118 (R-09) / DEC-119 (R-10): shared long-press detection.
 * Returns a binding factory; the click synthesized right after a long-press
 * release is swallowed in the capture phase so child buttons don't fire.
 */
export function useLongPress(onLongPress: (id: string) => void): (id: string) => LongPressBinding {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
  }, []);

  return useCallback(
    (id: string): LongPressBinding => ({
      onPointerDown: (e) => {
        cancelTimer();
        firedRef.current = false;
        originRef.current = { x: e.clientX, y: e.clientY };
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          firedRef.current = true;
          // N8: native-aware haptic (the WebView ignores navigator.vibrate).
          hapticImpact();
          onLongPress(id);
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e) => {
        const origin = originRef.current;
        if (origin === null) return;
        const moved = Math.abs(e.clientX - origin.x) + Math.abs(e.clientY - origin.y);
        if (moved > MOVE_TOLERANCE_PX) cancelTimer();
      },
      onPointerUp: cancelTimer,
      onPointerCancel: cancelTimer,
      onContextMenu: (e) => {
        // Long-press on mobile fires contextmenu — our action replaces it.
        e.preventDefault();
      },
      onClickCapture: (e) => {
        if (firedRef.current) {
          firedRef.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
    }),
    [cancelTimer, onLongPress],
  );
}
