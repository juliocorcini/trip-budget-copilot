import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';
import { useLiveSettings } from '@/hooks/useLiveSettings';
import i18n from '@/i18n';
import type { AppSettings } from '@/domain/types/app-settings';

// GAP-013 (D-F): theme reacts live to settings changes via liveQuery.
function useTheme(settings: AppSettings | undefined) {
  const pref = settings?.themePreference ?? 'dark';
  useEffect(() => {
    if (pref === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const apply = () => document.documentElement.setAttribute('data-theme', mq.matches ? 'light' : 'dark');
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    document.documentElement.setAttribute('data-theme', pref);
  }, [pref]);
}

// GAP-014: persisted language is applied live (and restored on boot).
function useLanguage(settings: AppSettings | undefined) {
  const language = settings?.language;
  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);
}

export function AppShell() {
  const settings = useLiveSettings();
  useTheme(settings);
  useLanguage(settings);
  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-surface text-on-surface pb-[100px]">
      <main className="px-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
