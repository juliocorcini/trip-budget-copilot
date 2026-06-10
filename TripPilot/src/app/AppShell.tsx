import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';

// Theme/language live application moved to RootLayout (DEC-083 / GAP-R2-003)
// so routes outside the shell are also covered.
export function AppShell() {
  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-surface text-on-surface pb-[100px]">
      <main className="px-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
