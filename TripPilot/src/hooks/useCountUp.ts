import { useEffect, useRef, useState } from 'react';

/**
 * Council (Connector/Visionary): "money responds". Tweens a numeric value from
 * its current displayed amount to a new target so a change reads as a reaction,
 * not a silent swap — the felt result of an action.
 *
 * Deliberately quiet:
 *  - No intro animation on first mount UNLESS an `initialFrom` is supplied that
 *    differs from the target — this lets a value animate across a route remount
 *    (e.g. save → navigate to dashboard) from its pre-action amount.
 *  - Skips animation when the value did not change (delta 0) or when disabled
 *    (e.g. prefers-reduced-motion), returning the target instantly.
 *  - Interruptions resume from wherever the number currently is (no jump).
 *
 * Read-only: this only animates how an already-correct number is displayed.
 */
export function useCountUp(
  target: number,
  enabled = true,
  initialFrom: number | null = null,
  durationMs = 500,
): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const settle = (v: number) => {
      valueRef.current = v;
      setValue(v);
    };

    const firstMount = !mountedRef.current;
    mountedRef.current = true;

    if (!enabled) {
      settle(target);
      return;
    }

    // Pick the tween's starting point: on first mount animate from `initialFrom`
    // (the pre-remount amount) when given and different; later, from whatever is
    // currently on screen. Otherwise snap.
    let from: number;
    if (firstMount) {
      if (initialFrom === null || initialFrom === target) {
        settle(target);
        return;
      }
      from = initialFrom;
      settle(initialFrom);
    } else {
      from = valueRef.current;
    }

    const delta = target - from;
    if (delta === 0) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      settle(Math.round(from + delta * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // `initialFrom` intentionally omitted: it only seeds the first-mount tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled, durationMs]);

  return value;
}
