import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * G3: a Google-Photos-style fast scroller for the (window-scrolled) expense feed.
 *
 * Only the small thumb is interactive — the rest of the strip is
 * `pointer-events-none`, so taps on expense rows underneath still go through.
 * Grabbing the thumb scrubs the page (we drive `window.scrollTo` directly) and a
 * floating bubble shows the day currently under the finger, read live from the
 * day-group anchors (`[data-expense-day]`) the list renders.
 */
interface FastScrollerProps {
  /** Number of day groups — the rail only appears when the feed is long. */
  dayCount: number;
}

const MIN_DAYS = 8;
const MIN_OVERFLOW_PX = 800;

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

export function FastScroller({ dayCount }: FastScrollerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [label, setLabel] = useState('');
  const [tallEnough, setTallEnough] = useState(false);

  useEffect(() => {
    const syncProgress = () => {
      const m = maxScroll();
      setProgress(m > 0 ? Math.min(1, window.scrollY / m) : 0);
    };
    const syncSize = () => {
      setTallEnough(maxScroll() > MIN_OVERFLOW_PX);
      syncProgress();
    };
    syncSize();
    window.addEventListener('scroll', syncProgress, { passive: true });
    window.addEventListener('resize', syncSize);
    // Content height changes (filters, async loads) without a scroll/resize event.
    const ro = new ResizeObserver(syncSize);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('scroll', syncProgress);
      window.removeEventListener('resize', syncSize);
      ro.disconnect();
    };
  }, [dayCount]);

  const stickyOffset = (): number => {
    const header = document.querySelector('.page-sticky-header');
    const rect = header?.getBoundingClientRect();
    return rect ? rect.bottom + 4 : 96;
  };

  const updateLabel = useCallback(() => {
    const anchors = document.querySelectorAll<HTMLElement>('[data-expense-day]');
    const first = anchors[0];
    if (!first) return;
    const offset = stickyOffset();
    let current = first.dataset.expenseLabel ?? '';
    for (const el of anchors) {
      if (el.getBoundingClientRect().top <= offset) current = el.dataset.expenseLabel ?? current;
      else break;
    }
    setLabel(current);
  }, []);

  const scrubToClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      window.scrollTo({ top: fraction * maxScroll() });
      setProgress(fraction);
      updateLabel();
    },
    [updateLabel],
  );

  if (dayCount < MIN_DAYS || !tallEnough) return null;

  return (
    <div
      ref={trackRef}
      className="fixed top-[var(--safe-top)] bottom-[120px] w-10 z-30 pointer-events-none"
      style={{ right: 'max(0px, calc((100vw - 430px) / 2))' }}
    >
      {/* Faint rail line — non-interactive. */}
      <div className="absolute right-2 top-2 bottom-2 w-0.5 rounded-full bg-on-surface-faint/20" />

      {/* The grab handle — the only interactive part. */}
      <div
        className="absolute right-0 w-10 h-12 -translate-y-1/2 flex items-center justify-end pointer-events-auto touch-none"
        style={{ top: `${progress * 100}%` }}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          updateLabel();
          scrubToClientY(e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging) scrubToClientY(e.clientY);
        }}
        onPointerUp={(e) => {
          setDragging(false);
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* capture may already be released */
          }
        }}
        onPointerCancel={() => setDragging(false)}
      >
        <div
          className={`rounded-full transition-all ${
            dragging ? 'w-2.5 h-10 bg-primary' : 'w-1.5 h-7 bg-on-surface-faint/60'
          }`}
        />
      </div>

      {/* Date bubble while scrubbing. */}
      {dragging && label && (
        <div
          className="absolute right-9 -translate-y-1/2 px-3 py-1.5 rounded-full bg-surface-container-high shadow-lg whitespace-nowrap"
          style={{ top: `${progress * 100}%` }}
        >
          <span className="text-xs font-bold text-on-surface">{label}</span>
        </div>
      )}
    </div>
  );
}
