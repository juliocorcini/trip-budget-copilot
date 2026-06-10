import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useLiveSettings } from '@/hooks/useLiveSettings';
import i18n from '@/i18n';
import type { AppSettings } from '@/domain/types/app-settings';

const THEME_COLOR: Record<'dark' | 'light', string> = {
  dark: '#0F1419',
  light: '#F5F0EB',
};

function applyTheme(resolved: 'dark' | 'light'): void {
  document.documentElement.setAttribute('data-theme', resolved);
  // DEC-083: Android status bar follows the active theme.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[resolved]);
}

// GAP-013 (D-F) + GAP-R2-003 (DEC-083): theme reacts live to settings changes
// via liveQuery, applied at the root so EVERY route is covered.
function useTheme(settings: AppSettings | undefined) {
  const pref = settings?.themePreference ?? 'dark';
  useEffect(() => {
    if (pref === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const apply = () => applyTheme(mq.matches ? 'light' : 'dark');
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    applyTheme(pref === 'light' ? 'light' : 'dark');
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

/** Root route element: wraps ALL routes (inside and outside the AppShell). */
export function RootLayout() {
  const settings = useLiveSettings();
  useTheme(settings);
  useLanguage(settings);
  return <Outlet />;
}
