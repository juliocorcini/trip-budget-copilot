import { Suspense, useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AppShell } from './AppShell';
import { RootLayout } from './RootLayout';
import { ModeGuard } from '@/components/ModeGuard';
import { lazyWithRetry } from '@/utils/lazy-with-retry';
import { hardReloadApp } from '@/data/db/db-recovery';

const DashboardPage = lazyWithRetry(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ExpenseListPage = lazyWithRetry(() => import('@/features/expenses/ExpenseListPage').then(m => ({ default: m.ExpenseListPage })));
const QuickAddPage = lazyWithRetry(() => import('@/features/expenses/QuickAddPage').then(m => ({ default: m.QuickAddPage })));
const PlannerPage = lazyWithRetry(() => import('@/features/planning/PlannerPage').then(m => ({ default: m.PlannerPage })));
const TripHubPage = lazyWithRetry(() => import('@/features/trip/TripHubPage').then(m => ({ default: m.TripHubPage })));
const CopilotPage = lazyWithRetry(() => import('@/features/copilot/CopilotPage').then(m => ({ default: m.CopilotPage })));
const SettingsPage = lazyWithRetry(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BackupPage = lazyWithRetry(() => import('@/features/backup/BackupPage').then(m => ({ default: m.BackupPage })));
const DashboardConfigPage = lazyWithRetry(() => import('@/features/settings/DashboardConfigPage').then(m => ({ default: m.DashboardConfigPage })));
const BootGate = lazyWithRetry(() => import('@/features/onboarding/BootGate').then(m => ({ default: m.BootGate })));
const WelcomePage = lazyWithRetry(() => import('@/features/onboarding/WelcomePage').then(m => ({ default: m.WelcomePage })));
const OnboardingPage = lazyWithRetry(() => import('@/features/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const SharedExpensesPage = lazyWithRetry(() => import('@/features/shared/SharedExpensesPage').then(m => ({ default: m.SharedExpensesPage })));
const OutingPage = lazyWithRetry(() => import('@/features/outing/OutingPage').then(m => ({ default: m.OutingPage })));
const OutingReviewPage = lazyWithRetry(() => import('@/features/outing/OutingReviewPage').then(m => ({ default: m.OutingReviewPage })));
const SimulatorPage = lazyWithRetry(() => import('@/features/simulator/SimulatorPage').then(m => ({ default: m.SimulatorPage })));
const RescuePage = lazyWithRetry(() => import('@/features/rescue/RescuePage').then(m => ({ default: m.RescuePage })));
const TripOverviewPage = lazyWithRetry(() => import('@/features/trip/TripOverviewPage').then(m => ({ default: m.TripOverviewPage })));
const TripEditPage = lazyWithRetry(() => import('@/features/trip/TripEditPage').then(m => ({ default: m.TripEditPage })));
const WalletsPage = lazyWithRetry(() => import('@/features/wallets/WalletsPage').then(m => ({ default: m.WalletsPage })));
const FundsPage = lazyWithRetry(() => import('@/features/funds/FundsPage').then(m => ({ default: m.FundsPage })));
const PlannedPurchasesPage = lazyWithRetry(() => import('@/features/planned/PlannedPurchasesPage').then(m => ({ default: m.PlannedPurchasesPage })));
const ProfilesPage = lazyWithRetry(() => import('@/features/profiles/ProfilesPage').then(m => ({ default: m.ProfilesPage })));
const ExpenseDetailPage = lazyWithRetry(() => import('@/features/expenses/ExpenseDetailPage').then(m => ({ default: m.ExpenseDetailPage })));
const AboutPage = lazyWithRetry(() => import('@/features/more/AboutPage').then(m => ({ default: m.AboutPage })));
const GuidePage = lazyWithRetry(() => import('@/features/guide/GuidePage').then(m => ({ default: m.GuidePage })));
const NotificationsPage = lazyWithRetry(() => import('@/features/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ImpactDetailPage = lazyWithRetry(() => import('@/features/dashboard/ImpactDetailPage').then(m => ({ default: m.ImpactDetailPage })));
const SyncReceivePage = lazyWithRetry(() => import('@/features/sync/SyncReceivePage').then(m => ({ default: m.SyncReceivePage })));

// DEC-170: a hung dynamic import (a chunk that never resolves AND never
// rejects — the 2021 WebKit fetch/IDB stall, or a dead network) would leave the
// Suspense fallback spinning forever. The stall watchdog turns that infinite
// spinner into a recoverable "reload" prompt so a route can never trap the user.
const STALL_MS = 12000;

function LoadingFallback() {
  // Continuity: most lazy chunks resolve in a few ms once cached, so showing the
  // spinner immediately just flashes it on every navigation ("page reloaded"
  // feeling). Delay it — fast loads then show nothing; only a genuinely slow
  // load surfaces the spinner.
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    const showId = setTimeout(() => setShow(true), 220);
    const stallId = setTimeout(() => setStalled(true), STALL_MS);
    return () => {
      clearTimeout(showId);
      clearTimeout(stallId);
    };
  }, []);

  if (stalled) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-surface-base px-8 text-center gap-4">
        <p className="text-sm text-on-surface-dim leading-relaxed">{t('loading.slow')}</p>
        <button
          onClick={hardReloadApp}
          className="btn-press px-6 py-3 rounded-xl bg-primary text-on-surface font-semibold"
        >
          {t('loading.reload')}
        </button>
      </div>
    );
  }
  if (!show) return null;
  return (
    <div className="flex items-center justify-center h-screen bg-surface-base">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// DEC-196 (N2 fix): the page-transition wrapper lives INSIDE the Suspense
// boundary. A suspending lazy child does not commit its parent until it
// resolves, so this `.route-view` mounts WITH content present and its enter
// animation always plays — on the first visit too (previously the wrapper
// mounted empty during the 220 ms Suspense gap and the animation finished before
// the chunk arrived, so only the cached second visit looked animated). Keyed by
// pathname so the animation replays on every navigation; direction comes from
// <html data-nav> (RootLayout).
function RouteView({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-view">
      {children}
    </div>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RouteView>{children}</RouteView>
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <LazyRoute><DashboardPage /></LazyRoute> },
          { path: '/expenses', element: <LazyRoute><ExpenseListPage /></LazyRoute> },
          { path: '/expenses/:id', element: <LazyRoute><ExpenseDetailPage /></LazyRoute> },
          { path: '/outings/:id/review', element: <LazyRoute><OutingReviewPage /></LazyRoute> },
          { path: '/planner', element: <LazyRoute><ModeGuard><PlannerPage /></ModeGuard></LazyRoute> },
          // Redesign (G1): the new IA. "Viagem" = plan/structure hub, "Copiloto"
          // = intelligence. The old "/more" route redirects into Viagem so any
          // bookmark or deep link still lands somewhere sensible.
          { path: '/viagem', element: <LazyRoute><TripHubPage /></LazyRoute> },
          { path: '/copiloto', element: <LazyRoute><CopilotPage /></LazyRoute> },
          { path: '/more', element: <Navigate to="/viagem" replace /> },
          { path: '/settings', element: <LazyRoute><SettingsPage /></LazyRoute> },
          { path: '/settings/backup', element: <LazyRoute><BackupPage /></LazyRoute> },
          { path: '/settings/dashboard', element: <LazyRoute><DashboardConfigPage /></LazyRoute> },
          { path: '/shared', element: <LazyRoute><SharedExpensesPage /></LazyRoute> },
          { path: '/trip', element: <LazyRoute><TripOverviewPage /></LazyRoute> },
          { path: '/trip/edit', element: <LazyRoute><TripEditPage /></LazyRoute> },
          { path: '/wallets', element: <LazyRoute><WalletsPage /></LazyRoute> },
          { path: '/funds', element: <LazyRoute><FundsPage /></LazyRoute> },
          { path: '/planned', element: <LazyRoute><PlannedPurchasesPage /></LazyRoute> },
          { path: '/profiles', element: <LazyRoute><ProfilesPage /></LazyRoute> },
          { path: '/about', element: <LazyRoute><AboutPage /></LazyRoute> },
          // G7: "Tudo que dá pra fazer" — a catalog of every feature so nothing
          // stays hidden behind a menu. Reachable from the gear and Copiloto.
          { path: '/guide', element: <LazyRoute><GuidePage /></LazyRoute> },
          { path: '/notifications', element: <LazyRoute><NotificationsPage /></LazyRoute> },
          { path: '/impact', element: <LazyRoute><ImpactDetailPage /></LazyRoute> },
        ],
      },
      { path: '/', element: <LazyRoute><BootGate /></LazyRoute> },
      { path: '/welcome', element: <LazyRoute><WelcomePage /></LazyRoute> },
      { path: '/onboarding', element: <LazyRoute><OnboardingPage /></LazyRoute> },
      { path: '/quick-add', element: <LazyRoute><QuickAddPage /></LazyRoute> },
      { path: '/outings/new', element: <LazyRoute><ModeGuard><OutingPage /></ModeGuard></LazyRoute> },
      { path: '/outings/active', element: <LazyRoute><ModeGuard><OutingPage /></ModeGuard></LazyRoute> },
      { path: '/simulator', element: <LazyRoute><ModeGuard><SimulatorPage /></ModeGuard></LazyRoute> },
      { path: '/rescue', element: <LazyRoute><RescuePage /></LazyRoute> },
      { path: '/sync', element: <LazyRoute><SyncReceivePage /></LazyRoute> },
    ],
  },
]);
