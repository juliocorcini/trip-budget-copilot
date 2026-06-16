import { useEffect, useState } from 'react';

export type PresenceState = 'open' | 'closing';

interface Presence {
  /** Whether the element should be in the DOM (stays true through the exit). */
  mounted: boolean;
  /** 'open' while visible, 'closing' while the exit animation plays. */
  state: PresenceState;
}

/**
 * Keeps an overlay mounted through its exit animation (DEC-194).
 *
 * Overlays that simply `return null` when closed can never animate out. This
 * hook keeps the node rendered for `exitMs` after `open` flips to false and
 * exposes `state` so the caller swaps the enter animation for the exit one.
 * Honors reduced motion implicitly: callers wire the exit animation through CSS,
 * which is neutralized globally under prefers-reduced-motion.
 */
export function useAnimatedPresence(open: boolean, exitMs = 180): Presence {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<PresenceState>(open ? 'open' : 'closing');

  useEffect(() => {
    if (open) {
      setMounted(true);
      setState('open');
      return;
    }
    if (!mounted) return;
    setState('closing');
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs, mounted]);

  return { mounted, state };
}
