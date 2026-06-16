import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { ActiveOutingBar } from '@/components/ActiveOutingBar';

// Theme/language live application moved to RootLayout (DEC-083 / GAP-R2-003)
// so routes outside the shell are also covered.
export function AppShell() {
  // DEC-196: the page-transition wrapper now lives in `LazyRoute` (inside the
  // Suspense boundary) so it animates with content on the first visit too. The
  // shell just keeps the stable chrome (nav bar, active-outing bar) mounted.
  return (
    <div className="max-w-[430px] mx-auto min-h-[calc(100dvh-var(--safe-top))] bg-surface text-on-surface pb-[calc(100px+var(--safe-bottom))] overflow-x-clip">
      {/* DEC-085 (R-02): single side-padding token for every page */}
      <main className="px-[var(--page-padding-x)]">
        <Outlet />
      </main>
      <ActiveOutingBar />
      <BottomNav />
    </div>
  );
}
