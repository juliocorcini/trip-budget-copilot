import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { FAB } from '@/components/FAB';

export function AppShell() {
  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24">
      <main className="max-w-[430px] mx-auto">
        <Outlet />
      </main>
      <FAB />
      <BottomNav />
    </div>
  );
}
