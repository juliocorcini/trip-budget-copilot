import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { ActiveOutingBar } from '@/components/ActiveOutingBar';
import { ActiveSplitBar } from '@/components/ActiveSplitBar';
import { useTabPaging } from '@/hooks/useTabPaging';
import { useTabSwipePager } from '@/hooks/useTabSwipePager';

// Theme/language live application moved to RootLayout (DEC-083 / GAP-R2-003)
// so routes outside the shell are also covered.
export function AppShell() {
  // DEC-196: the page-transition wrapper now lives in `LazyRoute` (inside the
  // Suspense boundary) so it animates with content on the first visit too. The
  // shell just keeps the stable chrome (nav bar, active-outing bar) mounted.
  // FIELD R2 (F10): the swipe pager is now interactive — the routed content
  // follows the finger and commits past a threshold (see useTabSwipePager). The
  // detector still lives on the full-height shell container so a swipe pages the
  // tabs even when it starts on the empty background (FIELD-01/02).
  const paging = useTabPaging();
  const { rootRef, contentRef } = useTabSwipePager(paging);

  return (
    <div
      ref={rootRef}
      className="max-w-[430px] mx-auto min-h-[calc(100dvh-var(--safe-top))] bg-surface text-on-surface pb-[calc(100px+var(--safe-bottom))] overflow-x-clip"
    >
      {/* DEC-085 (R-02): single side-padding token for every page. The drag
          pager translates this element (the outgoing content) with the finger;
          the fixed chrome (nav, active-outing bar) are siblings, so they stay
          put, and portaled sheets live outside #main entirely (DEC-195). */}
      <main ref={contentRef} className="px-[var(--page-padding-x)] will-change-transform">
        <Outlet />
      </main>
      <ActiveOutingBar />
      <ActiveSplitBar />
      <BottomNav />
      {/* DEC-246 / E03 (DEC-323): the app-wide AI quick-entry sheet is mounted
          once at RootLayout (not here), so openAssistant() also works on routes
          OUTSIDE the shell (Quick Add, Income, the pure tools). */}
    </div>
  );
}
