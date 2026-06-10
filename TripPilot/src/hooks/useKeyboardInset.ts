import { useState, useEffect } from 'react';

/**
 * R5-04: height (px) of the on-screen keyboard overlapping the layout
 * viewport. On iOS the keyboard overlays the page instead of resizing it —
 * visualViewport is the only reliable signal. Returns 0 when closed or when
 * the platform resizes the layout itself (Android with resizes-content).
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(overlap)));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
