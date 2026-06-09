import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';

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
const SimulatorPage = lazy(() => import('@/features/simulator/SimulatorPage').then(m => ({ default: m.SimulatorPage })));

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
    element: <AppShell />,
    children: [
      { path: '/dashboard', element: <LazyRoute><DashboardPage /></LazyRoute> },
      { path: '/expenses', element: <LazyRoute><ExpenseListPage /></LazyRoute> },
      { path: '/planner', element: <LazyRoute><PlannerPage /></LazyRoute> },
      { path: '/more', element: <LazyRoute><MorePage /></LazyRoute> },
      { path: '/settings', element: <LazyRoute><SettingsPage /></LazyRoute> },
      { path: '/settings/backup', element: <LazyRoute><BackupPage /></LazyRoute> },
      { path: '/shared', element: <LazyRoute><SharedExpensesPage /></LazyRoute> },
    ],
  },
  { path: '/', element: <LazyRoute><WelcomePage /></LazyRoute> },
  { path: '/welcome', element: <LazyRoute><WelcomePage /></LazyRoute> },
  { path: '/onboarding', element: <LazyRoute><OnboardingPage /></LazyRoute> },
  { path: '/quick-add', element: <LazyRoute><QuickAddPage /></LazyRoute> },
  { path: '/outings/new', element: <LazyRoute><OutingPage /></LazyRoute> },
  { path: '/outings/active', element: <LazyRoute><OutingPage /></LazyRoute> },
  { path: '/simulator', element: <LazyRoute><SimulatorPage /></LazyRoute> },
]);
