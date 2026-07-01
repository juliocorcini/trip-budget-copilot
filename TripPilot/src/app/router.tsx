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
const IncomePage = lazyWithRetry(() => import('@/features/income/IncomePage').then(m => ({ default: m.IncomePage })));
const PlannerPage = lazyWithRetry(() => import('@/features/planning/PlannerPage').then(m => ({ default: m.PlannerPage })));
const TripHubPage = lazyWithRetry(() => import('@/features/trip/TripHubPage').then(m => ({ default: m.TripHubPage })));
const CopilotPage = lazyWithRetry(() => import('@/features/copilot/CopilotPage').then(m => ({ default: m.CopilotPage })));
const SettingsPage = lazyWithRetry(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BackupPage = lazyWithRetry(() => import('@/features/backup/BackupPage').then(m => ({ default: m.BackupPage })));
const DashboardConfigPage = lazyWithRetry(() => import('@/features/settings/DashboardConfigPage').then(m => ({ default: m.DashboardConfigPage })));
const PaymentMethodsPage = lazyWithRetry(() => import('@/features/settings/PaymentMethodsPage').then(m => ({ default: m.PaymentMethodsPage })));
const BootGate = lazyWithRetry(() => import('@/features/onboarding/BootGate').then(m => ({ default: m.BootGate })));
const WelcomePage = lazyWithRetry(() => import('@/features/onboarding/WelcomePage').then(m => ({ default: m.WelcomePage })));
const OnboardingPage = lazyWithRetry(() => import('@/features/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const SharedExpensesPage = lazyWithRetry(() => import('@/features/shared/SharedExpensesPage').then(m => ({ default: m.SharedExpensesPage })));
const OutingPage = lazyWithRetry(() => import('@/features/outing/OutingPage').then(m => ({ default: m.OutingPage })));
const OutingReviewPage = lazyWithRetry(() => import('@/features/outing/OutingReviewPage').then(m => ({ default: m.OutingReviewPage })));
const SimulatorPage = lazyWithRetry(() => import('@/features/simulator/SimulatorPage').then(m => ({ default: m.SimulatorPage })));
const RescuePage = lazyWithRetry(() => import('@/features/rescue/RescuePage').then(m => ({ default: m.RescuePage })));
const TripEditPage = lazyWithRetry(() => import('@/features/trip/TripEditPage').then(m => ({ default: m.TripEditPage })));
const PhasePreviewPage = lazyWithRetry(() => import('@/features/phases/PhasePreviewPage').then(m => ({ default: m.PhasePreviewPage })));
const WalletsPage = lazyWithRetry(() => import('@/features/wallets/WalletsPage').then(m => ({ default: m.WalletsPage })));
const FundsPage = lazyWithRetry(() => import('@/features/funds/FundsPage').then(m => ({ default: m.FundsPage })));
const PlannedPurchasesPage = lazyWithRetry(() => import('@/features/planned/PlannedPurchasesPage').then(m => ({ default: m.PlannedPurchasesPage })));
const ProfilesPage = lazyWithRetry(() => import('@/features/profiles/ProfilesPage').then(m => ({ default: m.ProfilesPage })));
const ExpenseDetailPage = lazyWithRetry(() => import('@/features/expenses/ExpenseDetailPage').then(m => ({ default: m.ExpenseDetailPage })));
const EventGuidePage = lazyWithRetry(() => import('@/features/event/EventGuidePage').then(m => ({ default: m.EventGuidePage })));
const AboutPage = lazyWithRetry(() => import('@/features/more/AboutPage').then(m => ({ default: m.AboutPage })));
const GuidePage = lazyWithRetry(() => import('@/features/guide/GuidePage').then(m => ({ default: m.GuidePage })));
const HelpPage = lazyWithRetry(() => import('@/features/help/HelpPage').then(m => ({ default: m.HelpPage })));
const DiscoverHubPage = lazyWithRetry(() => import('@/features/discover/DiscoverHubPage').then(m => ({ default: m.DiscoverHubPage })));
const NotificationsPage = lazyWithRetry(() => import('@/features/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ImpactDetailPage = lazyWithRetry(() => import('@/features/dashboard/ImpactDetailPage').then(m => ({ default: m.ImpactDetailPage })));
const SyncReceivePage = lazyWithRetry(() => import('@/features/sync/SyncReceivePage').then(m => ({ default: m.SyncReceivePage })));
const WiseImportPage = lazyWithRetry(() => import('@/features/import/WiseImportPage').then(m => ({ default: m.WiseImportPage })));
const ReceiptScanPage = lazyWithRetry(() => import('@/features/receipt/ReceiptScanPage').then(m => ({ default: m.ReceiptScanPage })));
const SplitPage = lazyWithRetry(() => import('@/features/split/SplitPage').then(m => ({ default: m.SplitPage })));
const SplitTablePage = lazyWithRetry(() => import('@/features/split/SplitTablePage').then(m => ({ default: m.SplitTablePage })));
const SharedLinkPage = lazyWithRetry(() => import('@/features/shared/SharedLinkPage').then(m => ({ default: m.SharedLinkPage })));
const SharedWithMePage = lazyWithRetry(() => import('@/features/shared/SharedWithMePage').then(m => ({ default: m.SharedWithMePage })));
const PairPage = lazyWithRetry(() => import('@/features/shared/PairPage').then(m => ({ default: m.PairPage })));
const AdminPage = lazyWithRetry(() => import('@/features/admin/AdminPage').then(m => ({ default: m.AdminPage })));
const SpacesPage = lazyWithRetry(() => import('@/features/spaces/SpacesPage').then(m => ({ default: m.SpacesPage })));
const NewSpacePage = lazyWithRetry(() => import('@/features/spaces/NewSpacePage').then(m => ({ default: m.NewSpacePage })));
const ConverterPage = lazyWithRetry(() => import('@/features/converter/ConverterPage').then(m => ({ default: m.ConverterPage })));
const ComparatorPage = lazyWithRetry(() => import('@/features/comparator/ComparatorPage').then(m => ({ default: m.ComparatorPage })));
// DEC-416 (G11): "spends on the map". Lazy so Leaflet + the marker-cluster plugin
// (imported only inside this page) ship in the `/mapa` chunk, not the core bundle.
const ExpenseMapPage = lazyWithRetry(() => import('@/features/map/ExpenseMapPage').then(m => ({ default: m.ExpenseMapPage })));
const GroupSplitListPage = lazyWithRetry(() => import('@/features/group-split/GroupSplitListPage').then(m => ({ default: m.GroupSplitListPage })));
const GroupSplitDetailPage = lazyWithRetry(() => import('@/features/group-split/GroupSplitDetailPage').then(m => ({ default: m.GroupSplitDetailPage })));
const GroupClaimPage = lazyWithRetry(() => import('@/features/group-split/GroupClaimPage').then(m => ({ default: m.GroupClaimPage })));
const InstallPage = lazyWithRetry(() => import('@/features/install/InstallPage').then(m => ({ default: m.InstallPage })));

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
          // DEC-401 (G2): the event guide — follow/understand/remember an event
          // (rhythm, all spends, outings, edit, end). The live-event card + its
          // "+N mais" navigate here.
          { path: '/event/:id', element: <LazyRoute><EventGuidePage /></LazyRoute> },
          { path: '/outings/:id/review', element: <LazyRoute><OutingReviewPage /></LazyRoute> },
          { path: '/planner', element: <LazyRoute><ModeGuard><PlannerPage /></ModeGuard></LazyRoute> },
          // Redesign (G1): the new IA. "Viagem" = plan/structure hub, "Copiloto"
          // = intelligence. The old "/more" route redirects into Viagem so any
          // bookmark or deep link still lands somewhere sensible.
          { path: '/viagem', element: <LazyRoute><TripHubPage /></LazyRoute> },
          { path: '/copiloto', element: <LazyRoute><CopilotPage /></LazyRoute> },
          { path: '/more', element: <Navigate to="/viagem" replace /> },
          { path: '/settings', element: <LazyRoute><SettingsPage /></LazyRoute> },
          // F11: a focused single-category settings subpage (Samsung-style).
          { path: '/settings/c/:categoryId', element: <LazyRoute><SettingsPage /></LazyRoute> },
          { path: '/settings/backup', element: <LazyRoute><BackupPage /></LazyRoute> },
          { path: '/settings/dashboard', element: <LazyRoute><DashboardConfigPage /></LazyRoute> },
          { path: '/settings/payment-methods', element: <LazyRoute><PaymentMethodsPage /></LazyRoute> },
          { path: '/shared', element: <LazyRoute><SharedExpensesPage /></LazyRoute> },
          // F19: device pairing via a shared link — the recipient (an owner with a
          // trip) confirms before the sender's identity is paired into their trip.
          { path: '/pair', element: <LazyRoute><PairPage /></LazyRoute> },
          // DEC-288 (M15): the trip "overview" is consolidated into the Viagem
          // hub. Keep the path as a redirect so old links/bookmarks still land.
          { path: '/trip', element: <Navigate to="/viagem" replace /> },
          { path: '/trip/edit', element: <LazyRoute><TripEditPage /></LazyRoute> },
          // F17 + F18: read-only "future vision" preview of a phase (day-one
          // projection + planned income), reached from the trip's phase list.
          { path: '/phase-preview/:phaseId', element: <LazyRoute><PhasePreviewPage /></LazyRoute> },
          { path: '/wallets', element: <LazyRoute><WalletsPage /></LazyRoute> },
          { path: '/funds', element: <LazyRoute><FundsPage /></LazyRoute> },
          { path: '/planned', element: <LazyRoute><PlannedPurchasesPage /></LazyRoute> },
          { path: '/profiles', element: <LazyRoute><ProfilesPage /></LazyRoute> },
          { path: '/about', element: <LazyRoute><AboutPage /></LazyRoute> },
          // G7: "Tudo que dá pra fazer" — a catalog of every feature so nothing
          // stays hidden behind a menu. Reachable from the gear and Copiloto.
          { path: '/guide', element: <LazyRoute><GuidePage /></LazyRoute> },
          // FB-28 V1 (DEC-278): the local help center / concierge — searchable
          // Q&A with concrete steps and a deep-link per answer (0 token).
          { path: '/help', element: <LazyRoute><HelpPage /></LazyRoute> },
          // D02 (DEC-307/308): the discovery hub — find any function by intent
          // (reuses searchHelp) or browse everything the app does, in one screen.
          { path: '/descobrir', element: <LazyRoute><DiscoverHubPage /></LazyRoute> },
          { path: '/notifications', element: <LazyRoute><NotificationsPage /></LazyRoute> },
          { path: '/impact', element: <LazyRoute><ImpactDetailPage /></LazyRoute> },
          // DEC-249: the multi-space switcher (trips + "Dia a dia"), opened from
          // the active-space chip. Swaps `activeTrip` with a confirm.
          { path: '/spaces', element: <LazyRoute><SpacesPage /></LazyRoute> },
          { path: '/spaces/new', element: <LazyRoute><NewSpacePage /></LazyRoute> },
          // C23 (Tricount group split, DEC-297): the group-split home + one event.
          { path: '/groups', element: <LazyRoute><GroupSplitListPage /></LazyRoute> },
          { path: '/groups/:id', element: <LazyRoute><GroupSplitDetailPage /></LazyRoute> },
        ],
      },
      { path: '/', element: <LazyRoute><BootGate /></LazyRoute> },
      { path: '/welcome', element: <LazyRoute><WelcomePage /></LazyRoute> },
      { path: '/onboarding', element: <LazyRoute><OnboardingPage /></LazyRoute> },
      { path: '/quick-add', element: <LazyRoute><QuickAddPage /></LazyRoute> },
      { path: '/income', element: <LazyRoute><IncomePage /></LazyRoute> },
      { path: '/outings/new', element: <LazyRoute><ModeGuard><OutingPage /></ModeGuard></LazyRoute> },
      { path: '/outings/active', element: <LazyRoute><ModeGuard><OutingPage /></ModeGuard></LazyRoute> },
      { path: '/simulator', element: <LazyRoute><ModeGuard><SimulatorPage /></ModeGuard></LazyRoute> },
      // FB-04 (DEC-256): the currency converter is a pure, mode-agnostic tool
      // (works in a trip or in "Dia a dia"), so it lives outside ModeGuard.
      { path: '/converter', element: <LazyRoute><ConverterPage /></LazyRoute> },
      // DEC-283: the cost-benefit comparator (price per kg/L/unit) is a pure,
      // mode-agnostic tool like the converter, so it lives outside ModeGuard.
      { path: '/comparator', element: <LazyRoute><ComparatorPage /></LazyRoute> },
      // DEC-416 (G11): "spends on the map" — a full-screen, satellite-first map of
      // every located spend. Standalone (immersive, no bottom nav) like the tools.
      { path: '/mapa', element: <LazyRoute><ExpenseMapPage /></LazyRoute> },
      { path: '/rescue', element: <LazyRoute><RescuePage /></LazyRoute> },
      { path: '/sync', element: <LazyRoute><SyncReceivePage /></LazyRoute> },
      // Item A (DEC-362): the shareable "Instalar o TripPilot" landing. Outside
      // BootGate/AppShell so a cold visitor with no trip lands here directly.
      { path: '/install', element: <LazyRoute><InstallPage /></LazyRoute> },
      { path: '/import/wise', element: <LazyRoute><ModeGuard><WiseImportPage /></ModeGuard></LazyRoute> },
      { path: '/receipt/scan', element: <LazyRoute><ReceiptScanPage /></LazyRoute> },
      // T1/T2 (bill split): "Dividir conta" — the receipt scanner's superset
      // (capture → tax → mode fork → claim → commit as a navigable shared expense).
      { path: '/split/scan', element: <LazyRoute><SplitPage /></LazyRoute> },
      // DEC-207 (Shared Participant Link): the guest entry + home live OUTSIDE
      // BootGate so a guest with no trip is never bounced to onboarding.
      { path: '/s/:id', element: <LazyRoute><SharedLinkPage /></LazyRoute> },
      // G2 (bill split live table): the guest claim board — also outside BootGate.
      { path: '/t/:id', element: <LazyRoute><SplitTablePage /></LazyRoute> },
      // C23 (Tricount group split, DEC-297): the group guest claim board — pick
      // your name, see your balance, mark paid. Outside BootGate like `/t/`.
      { path: '/g/:id', element: <LazyRoute><GroupClaimPage /></LazyRoute> },
      { path: '/shared-with-me', element: <LazyRoute><SharedWithMePage /></LazyRoute> },
      // DEC-248: owner-only usage dashboard. Standalone (outside BootGate + the
      // app shell) and token-gated by the Worker ADMIN_TOKEN — never linked in nav.
      { path: '/admin', element: <LazyRoute><AdminPage /></LazyRoute> },
    ],
  },
]);
