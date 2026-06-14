import { useEffect, useState } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` setting so motion (count-ups,
 * transitions) can be disabled for people who ask for it. Starts `false` (the
 * common case) and updates live if the OS setting changes.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}
