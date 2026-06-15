import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useLiveSettings } from '@/hooks/useLiveSettings';
import { AppDataProvider } from '@/app/AppDataProvider';
import { AppLockGate } from '@/app/AppLockGate';
import { isNativeApp, applyNativeStatusBar } from '@/utils/native';
import i18n from '@/i18n';
import type { AppSettings } from '@/domain/types/app-settings';

const THEME_COLOR: Record<'dark' | 'light', string> = {
  dark: '#0F1419',
  light: '#F5F0EB',
};

function applyTheme(resolved: 'dark' | 'light'): void {
  document.documentElement.setAttribute('data-theme', resolved);
  // DEC-083: Android status bar follows the active theme (web/PWA via meta tag).
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[resolved]);
  // DEC-192: in the native shell the meta tag does nothing — drive the real
  // status bar (color + icon contrast) through the plugin. No-op on the web.
  void applyNativeStatusBar(resolved);
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

// BUG-020: Android hardware "back" on the landing screen pops out of the PWA
// because nothing sits below it in the history stack. We seed one buffer entry
// and, on `popstate`, re-seed it ONLY while the user is on a home route
// (`/` or `/dashboard`) — so the back press is absorbed there and the app
// stays open. Sub-pages are never touched, so in-app back navigation keeps
// working normally. The same history.state is preserved to keep React Router's
// location key stable. The native Capacitor shell (DEC-017) will later own
// this via App.addListener('backButton').
const HOME_PATHS = new Set(['/', '/dashboard']);

function useBackButtonGuard() {
  useEffect(() => {
    // DEC-193: the native shell owns the back button via @capacitor/app
    // (initNativeShell). This web-only history hack would fight it, so skip it.
    if (isNativeApp()) return;
    const seedBuffer = () => window.history.pushState(window.history.state, '');
    seedBuffer();
    const onPopState = () => {
      if (HOME_PATHS.has(window.location.pathname)) seedBuffer();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}

/** Root route element: wraps ALL routes (inside and outside the AppShell). */
export function RootLayout() {
  const settings = useLiveSettings();
  useTheme(settings);
  useLanguage(settings);
  useBackButtonGuard();
  // BUG-007: a single AppDataProvider above every route.
  // E6 (M20): the lock gate sits just below it so the PIN screen can read live
  // settings while still protecting every route once enabled.
  return (
    <AppDataProvider>
      <AppLockGate>
        <Outlet />
      </AppLockGate>
    </AppDataProvider>
  );
}
