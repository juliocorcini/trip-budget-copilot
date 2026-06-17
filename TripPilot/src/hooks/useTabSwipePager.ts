import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import type { TabPaging } from '@/hooks/useTabPaging';

/**
 * FIELD R2 item 10 (F10): interactive drag paging — the routed content follows
 * the finger during a horizontal swipe, rubber-bands at the edges, and on
 * release either commits (hands the navigation to the route's CSS enter
 * animation) or springs back. It replaces the previous "decide on touch-end +
 * CSS slide" pager while keeping that exact behaviour as the fallback for
 * reduced-motion and as a quick-flick path.
 *
 * Design notes (why it is safe against the known regressions):
 *  - The live transform is applied to the OUTGOING content element (`<main>`),
 *    imperatively, so it never re-renders per touch move (60 fps).
 *  - A gesture that begins inside a horizontal scroller / a `data-inpage-swipe`
 *    region is skipped, exactly like the old pager, so carousels and the
 *    Expenses sub-tabs keep owning their own swipes.
 *  - On commit we DON'T animate the outgoing page out (which would fight the
 *    always-"forward" history direction and cross the incoming page); we simply
 *    navigate and let the existing `.route-view` enter animation play. A
 *    layout effect clears the drag transform before paint, so the swap never
 *    flashes the old content at rest.
 *  - Listeners are attached natively (non-passive touchmove) so the horizontal
 *    drag can `preventDefault` the vertical scroll once the axis is locked,
 *    without making inner horizontal scrollers passive.
 *
 * Set INTERACTIVE_DRAG to false to revert to the pre-F10 touch-end slide without
 * removing the code path.
 */
const INTERACTIVE_DRAG = true;

// Travel (px) before the gesture commits to an axis (avoids hijacking taps).
const ACTIVATION_PX = 8;
// Horizontal must beat vertical by this ratio to be read as a drag (not scroll).
const HORIZONTAL_BIAS = 1.2;
// Commit once the drag passes ~28% of the width…
const COMMIT_RATIO = 0.28;
// …but never demand more than this absolute distance on a wide screen.
const COMMIT_MAX_PX = 140;
// A short, fast flick commits even below the distance threshold.
const FLICK_THRESHOLD = 60;
const FLICK_MAX_MS = 300;
// Rubber-band factor when the swiped direction has no neighbour tab.
const EDGE_RESISTANCE = 0.32;
// Matches --motion-base (220ms) plus a small buffer for the settle cleanup.
const SETTLE_MS = 240;

interface DragStart {
  x: number;
  y: number;
  at: number;
}

// A gesture that begins inside a horizontal scroller (carousels, chip rows) or a
// region that owns its own swipe (`data-inpage-swipe`) or opts out
// (`data-no-tab-swipe`) must NOT page the tabs — it belongs to that component.
function startsInHorizontalGesture(target: EventTarget | null, root: HTMLElement | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== root) {
    const ds = el.dataset;
    if (ds.noTabSwipe !== undefined || ds.inpageSwipe !== undefined) return true;
    const style = window.getComputedStyle(el);
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth + 4
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

export interface TabSwipePager {
  rootRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
}

export function useTabSwipePager(paging: TabPaging): TabSwipePager {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const location = useLocation();
  // The native listeners are attached once; keep the latest paging snapshot in a
  // ref so canPrev/canNext/goers are always current without re-binding.
  const pagingRef = useRef(paging);
  pagingRef.current = paging;

  // Clear any drag transform whenever the route actually changes — this runs
  // after the new content is committed but BEFORE paint, so a committed swipe
  // never flashes the outgoing page at rest.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
    }
  }, [location.pathname]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let start: DragStart | null = null;
    let skip = false;
    let axis: 'h' | 'v' | null = null;
    let dragging = false;
    let width = 0;
    let reduced = false;
    let settle: number | null = null;

    const clearSettle = () => {
      if (settle !== null) {
        window.clearTimeout(settle);
        settle = null;
      }
    };

    const applyTransform = (dx: number) => {
      const el = contentRef.current;
      if (!el) return;
      el.style.transition = 'none';
      el.style.transform = dx === 0 ? '' : `translate3d(${dx}px, 0, 0)`;
    };

    const springBack = () => {
      const el = contentRef.current;
      if (!el) return;
      el.style.transition = 'transform var(--motion-base) var(--ease-out)';
      // Reflow so the transition runs from the current (dragged) transform.
      void el.offsetWidth;
      el.style.transform = 'translate3d(0, 0, 0)';
      clearSettle();
      settle = window.setTimeout(() => {
        el.style.transition = '';
        el.style.transform = '';
        settle = null;
      }, SETTLE_MS);
    };

    const resist = (dx: number): number => {
      const p = pagingRef.current;
      if (dx < 0 && !p.canNext) return dx * EDGE_RESISTANCE;
      if (dx > 0 && !p.canPrev) return dx * EDGE_RESISTANCE;
      return dx;
    };

    const onStart = (e: TouchEvent) => {
      clearSettle();
      const el = contentRef.current;
      if (el) el.style.transition = '';
      const touch = e.touches.length === 1 ? e.touches[0] : undefined;
      start = touch ? { x: touch.clientX, y: touch.clientY, at: Date.now() } : null;
      skip = startsInHorizontalGesture(e.target, root);
      axis = null;
      dragging = false;
      width = root.clientWidth || window.innerWidth;
      reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    };

    const onMove = (e: TouchEvent) => {
      if (!start || skip || !INTERACTIVE_DRAG || reduced) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (axis === null) {
        if (Math.abs(dx) < ACTIVATION_PX && Math.abs(dy) < ACTIVATION_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BIAS ? 'h' : 'v';
      }
      if (axis !== 'h') return;
      dragging = true;
      // Now that the gesture is locked horizontal, stop the page from scrolling.
      if (e.cancelable) e.preventDefault();
      applyTransform(resist(dx));
    };

    const onEnd = (e: TouchEvent) => {
      const origin = start;
      start = null;
      if (!origin || skip) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      const p = pagingRef.current;

      // Reduced motion, flag off, or the drag never engaged → the original
      // touch-end decision (distance + horizontal dominance), no live transform.
      if (!INTERACTIVE_DRAG || reduced || !dragging) {
        if (Math.abs(dx) < FLICK_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) p.goNextTab();
        else p.goPrevTab();
        return;
      }

      dragging = false;
      axis = null;
      const commitDistance = Math.min(COMMIT_MAX_PX, width * COMMIT_RATIO);
      const elapsed = Date.now() - origin.at;
      const isFlick = Math.abs(dx) > FLICK_THRESHOLD && elapsed < FLICK_MAX_MS;
      const goingNext = dx < 0;
      const allowed = goingNext ? p.canNext : p.canPrev;

      if (allowed && (Math.abs(dx) > commitDistance || isFlick)) {
        // Hand off to the route's CSS enter animation. The layout effect clears
        // the drag transform before paint, so there is no snap-back flash.
        if (goingNext) p.goNextTab();
        else p.goPrevTab();
      } else {
        springBack();
      }
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      clearSettle();
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return { rootRef, contentRef };
}
