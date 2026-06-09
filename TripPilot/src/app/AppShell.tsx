import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { useAppData } from '@/hooks/useAppData';

function useTheme() {
  const { settings } = useAppData();
  useEffect(() => {
    const pref = settings?.themePreference ?? 'dark';
    if (pref === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const apply = () => document.documentElement.setAttribute('data-theme', mq.matches ? 'light' : 'dark');
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    document.documentElement.setAttribute('data-theme', pref);
  }, [settings?.themePreference]);
}

export function AppShell() {
  useTheme();
  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-surface text-on-surface pb-[100px]">
      <main className="px-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
