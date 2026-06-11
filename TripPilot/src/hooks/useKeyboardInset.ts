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

    // R6-14 (R5-04): iOS does not always settle the viewport back when the
    // keyboard closes — the page stays "pushed up". Force the layout back
    // whenever the inset returns to 0 and on focusout of form fields.
    let lastInset = 0;

    const update = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      const next = Math.max(0, Math.round(overlap));
      if (lastInset > 0 && next === 0) window.scrollTo(0, 0);
      lastInset = next;
      setInset(next);
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const el = document.activeElement;
        const stillTyping =
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement;
        if (!stillTyping) window.scrollTo(0, 0);
      }, 250);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return inset;
}
