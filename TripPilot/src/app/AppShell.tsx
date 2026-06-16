import { Outlet, useLocation } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { ActiveOutingBar } from '@/components/ActiveOutingBar';

// Theme/language live application moved to RootLayout (DEC-083 / GAP-R2-003)
// so routes outside the shell are also covered.
export function AppShell() {
  // DEC-194: keying the wrapper by pathname remounts ONLY the routed content on
  // navigation, so its enter animation replays while the chrome (nav bar,
  // active-outing bar) stays mounted — the "open a page" feel without re-running
  // the persistent UI. Direction (forward/back) comes from <html data-nav>.
  const location = useLocation();
  return (
    <div className="max-w-[430px] mx-auto min-h-[calc(100dvh-var(--safe-top))] bg-surface text-on-surface pb-[calc(100px+var(--safe-bottom))] overflow-x-clip">
      {/* DEC-085 (R-02): single side-padding token for every page */}
      <main className="px-[var(--page-padding-x)]">
        <div key={location.pathname} className="route-view">
          <Outlet />
        </div>
      </main>
      <ActiveOutingBar />
      <BottomNav />
    </div>
  );
}
