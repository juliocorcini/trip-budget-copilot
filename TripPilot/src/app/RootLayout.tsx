import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { consumePendingTabDirection } from '@/app/nav-direction';
import { useLiveSettings } from '@/hooks/useLiveSettings';
import { AppDataProvider } from '@/app/AppDataProvider';
import { AppLockGate } from '@/app/AppLockGate';
import { isNativeApp, applyNativeStatusBar } from '@/utils/native';
import { initDeepLinks } from '@/utils/native/deep-link';
import { hasPendingSharedCsv, setSharedCsvNavHandler } from '@/utils/native/share-target';
import { setHapticsEnabled } from '@/utils/haptics';
import { sendHeartbeatIfDue } from '@/utils/telemetry';
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

// N8: keep the haptics boundary in sync with the "Vibration" preference so the
// toggle turns ALL feedback on/off app-wide (default on until settings load).
function useHapticsPreference(settings: AppSettings | undefined) {
  const vibration = settings?.vibrationEnabled ?? true;
  useEffect(() => {
    setHapticsEnabled(vibration);
  }, [vibration]);
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

// DEC-194: the page transition needs a direction so a "back" (in-app button or
// the hardware/gesture back) animates the opposite way from a "forward". React
// Router stores a monotonically increasing `idx` on history.state for every
// entry; comparing it to the previous value classifies the navigation without
// touching any of the dozens of navigate() call sites. Exposed to CSS as a data
// attribute on <html> so the keyframe selection is a pure styling concern.
//
// D-BUG-10: a bottom-bar tab switch is always a push (idx rises), so it would
// always read "forward". The tab navigators record the swipe-order direction in
// `nav-direction`; we consume that override here for the one transition (and
// still advance `lastIdx`, so the NEXT plain navigation compares correctly).
function useNavDirection() {
  const location = useLocation();
  const lastIdx = useRef<number>(
    (window.history.state?.idx as number | undefined) ?? 0,
  );
  useEffect(() => {
    const idx = (window.history.state?.idx as number | undefined) ?? 0;
    const tabOverride = consumePendingTabDirection();
    document.documentElement.dataset.nav =
      tabOverride ?? (idx < lastIdx.current ? 'back' : 'forward');
    lastIdx.current = idx;
  }, [location]);
}

// B1 + B2 (Onda 4 / DEC-215): route native entry points into the SPA.
//  - App Links (`/pair`, `/s/:id`) → navigate preserving the `#fragment`.
//  - A shared `.csv` → open the Wise import preview (`?shared=1`).
// Native-only: every boundary is guarded by `isNativeApp()` inside the utils,
// so the web/PWA build is untouched (links resolve in the browser as before).
const SHARED_IMPORT_ROUTE = '/import/wise?shared=1';

function useNativeIntents() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp()) return;
    const disposeDeepLinks = initDeepLinks((to) => navigate(to));
    setSharedCsvNavHandler(() => navigate(SHARED_IMPORT_ROUTE));
    // The app may have been cold-started by a share before this mounted.
    if (hasPendingSharedCsv()) navigate(SHARED_IMPORT_ROUTE);
    return () => {
      disposeDeepLinks();
      setSharedCsvNavHandler(null);
    };
  }, [navigate]);
}

// DEC-248: fire an anonymous usage heartbeat on app open and on resume to the
// foreground. The send itself is throttled to one success per UTC day inside
// sendHeartbeatIfDue, so a resume costs nothing. Best-effort, silent, and honors
// the telemetryEnabled opt-out — it never blocks or surfaces to the user.
function useTelemetryHeartbeat() {
  useEffect(() => {
    void sendHeartbeatIfDue();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sendHeartbeatIfDue();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}

/** Root route element: wraps ALL routes (inside and outside the AppShell). */
export function RootLayout() {
  const settings = useLiveSettings();
  useTheme(settings);
  useLanguage(settings);
  useHapticsPreference(settings);
  useBackButtonGuard();
  useNavDirection();
  useNativeIntents();
  useTelemetryHeartbeat();
  // BUG-007: a single AppDataProvider above every route.
  // E6 (M20): the lock gate sits just below it so the PIN screen can read live
  // settings while still protecting every route once enabled.
  return (
    <AppDataProvider>
      {/* FIELD-12: reset scroll to the top on every forward navigation and
          restore it on back. Without this, React Router keeps the previous
          window scrollY, so a taller sub-page (Compras pessoais/planejadas…)
          opened from a scrolled list appeared already scrolled — hiding its
          title and back button. */}
      <ScrollRestoration />
      {/* DEC-192: opaque band over the (transparent, edge-to-edge) status bar —
          rendered above the lock gate so it covers every screen, including the
          PIN screen. No-op when --safe-top is 0. */}
      <div className="app-status-band" aria-hidden />
      <AppLockGate>
        {/* Pads ALL routes (inside and outside the shell) below the status bar. */}
        <div className="app-safe-top">
          <Outlet />
        </div>
      </AppLockGate>
    </AppDataProvider>
  );
}
