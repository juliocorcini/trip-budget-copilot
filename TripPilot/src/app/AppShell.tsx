import { useRef, type TouchEvent } from 'react';
import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { ActiveOutingBar } from '@/components/ActiveOutingBar';
import { useTabPaging } from '@/hooks/useTabPaging';

// FIELD-01/02: a swipe must page the tabs even when it starts on the empty
// background — so the detector lives on the full-height shell container, not on
// each page. The decision is made on touch-end (never preventDefault) so it
// never fights vertical scrolling. 60px of horizontal travel that dominates the
// vertical delta counts as a paging swipe.
const SWIPE_THRESHOLD = 60;

// A gesture that begins inside a horizontal scroller (carousels, chip rows) or
// a region that owns its own swipe (`data-inpage-swipe`) or opts out
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

// Theme/language live application moved to RootLayout (DEC-083 / GAP-R2-003)
// so routes outside the shell are also covered.
export function AppShell() {
  // DEC-196: the page-transition wrapper now lives in `LazyRoute` (inside the
  // Suspense boundary) so it animates with content on the first visit too. The
  // shell just keeps the stable chrome (nav bar, active-outing bar) mounted.
  const paging = useTabPaging();
  const rootRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const skip = useRef(false);

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches.length === 1 ? e.touches[0] : undefined;
    start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    skip.current = startsInHorizontalGesture(e.target, rootRef.current);
  };

  const onTouchEnd = (e: TouchEvent) => {
    const origin = start.current;
    start.current = null;
    if (!origin || skip.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) paging.goNextTab();
    else paging.goPrevTab();
  };

  return (
    <div
      ref={rootRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="max-w-[430px] mx-auto min-h-[calc(100dvh-var(--safe-top))] bg-surface text-on-surface pb-[calc(100px+var(--safe-bottom))] overflow-x-clip"
    >
      {/* DEC-085 (R-02): single side-padding token for every page */}
      <main className="px-[var(--page-padding-x)]">
        <Outlet />
      </main>
      <ActiveOutingBar />
      <BottomNav />
    </div>
  );
}
