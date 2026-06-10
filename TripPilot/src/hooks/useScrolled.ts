import { useEffect, useState } from 'react';

const SCROLL_THRESHOLD_PX = 8;

/**
 * DEC-084 (R-01): true once the window has scrolled past a small threshold —
 * drives the subtle elevation of the sticky page headers.
 */
export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return scrolled;
}
