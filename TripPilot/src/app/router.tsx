import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { RootLayout } from './RootLayout';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ExpenseListPage = lazy(() => import('@/features/expenses/ExpenseListPage').then(m => ({ default: m.ExpenseListPage })));
const QuickAddPage = lazy(() => import('@/features/expenses/QuickAddPage').then(m => ({ default: m.QuickAddPage })));
const PlannerPage = lazy(() => import('@/features/planning/PlannerPage').then(m => ({ default: m.PlannerPage })));
const MorePage = lazy(() => import('@/features/more/MorePage').then(m => ({ default: m.MorePage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BackupPage = lazy(() => import('@/features/backup/BackupPage').then(m => ({ default: m.BackupPage })));
const WelcomePage = lazy(() => import('@/features/onboarding/WelcomePage').then(m => ({ default: m.WelcomePage })));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const SharedExpensesPage = lazy(() => import('@/features/shared/SharedExpensesPage').then(m => ({ default: m.SharedExpensesPage })));
const OutingPage = lazy(() => import('@/features/outing/OutingPage').then(m => ({ default: m.OutingPage })));
const OutingReviewPage = lazy(() => import('@/features/outing/OutingReviewPage').then(m => ({ default: m.OutingReviewPage })));
const SimulatorPage = lazy(() => import('@/features/simulator/SimulatorPage').then(m => ({ default: m.SimulatorPage })));
const TripOverviewPage = lazy(() => import('@/features/trip/TripOverviewPage').then(m => ({ default: m.TripOverviewPage })));
const TripEditPage = lazy(() => import('@/features/trip/TripEditPage').then(m => ({ default: m.TripEditPage })));
const WalletsPage = lazy(() => import('@/features/wallets/WalletsPage').then(m => ({ default: m.WalletsPage })));
const FundsPage = lazy(() => import('@/features/funds/FundsPage').then(m => ({ default: m.FundsPage })));
const ProfilesPage = lazy(() => import('@/features/profiles/ProfilesPage').then(m => ({ default: m.ProfilesPage })));
const ExpenseDetailPage = lazy(() => import('@/features/expenses/ExpenseDetailPage').then(m => ({ default: m.ExpenseDetailPage })));
const AboutPage = lazy(() => import('@/features/more/AboutPage').then(m => ({ default: m.AboutPage })));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ImpactDetailPage = lazy(() => import('@/features/dashboard/ImpactDetailPage').then(m => ({ default: m.ImpactDetailPage })));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface-base">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {children}
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
          { path: '/planner', element: <LazyRoute><PlannerPage /></LazyRoute> },
          { path: '/more', element: <LazyRoute><MorePage /></LazyRoute> },
          { path: '/settings', element: <LazyRoute><SettingsPage /></LazyRoute> },
          { path: '/settings/backup', element: <LazyRoute><BackupPage /></LazyRoute> },
          { path: '/shared', element: <LazyRoute><SharedExpensesPage /></LazyRoute> },
          { path: '/trip', element: <LazyRoute><TripOverviewPage /></LazyRoute> },
          { path: '/trip/edit', element: <LazyRoute><TripEditPage /></LazyRoute> },
          { path: '/wallets', element: <LazyRoute><WalletsPage /></LazyRoute> },
          { path: '/funds', element: <LazyRoute><FundsPage /></LazyRoute> },
          { path: '/profiles', element: <LazyRoute><ProfilesPage /></LazyRoute> },
          { path: '/about', element: <LazyRoute><AboutPage /></LazyRoute> },
          { path: '/notifications', element: <LazyRoute><NotificationsPage /></LazyRoute> },
          { path: '/impact', element: <LazyRoute><ImpactDetailPage /></LazyRoute> },
        ],
      },
      { path: '/', element: <LazyRoute><WelcomePage /></LazyRoute> },
      { path: '/welcome', element: <LazyRoute><WelcomePage /></LazyRoute> },
      { path: '/onboarding', element: <LazyRoute><OnboardingPage /></LazyRoute> },
      { path: '/quick-add', element: <LazyRoute><QuickAddPage /></LazyRoute> },
      { path: '/outings/new', element: <LazyRoute><OutingPage /></LazyRoute> },
      { path: '/outings/active', element: <LazyRoute><OutingPage /></LazyRoute> },
      { path: '/simulator', element: <LazyRoute><SimulatorPage /></LazyRoute> },
    ],
  },
]);
