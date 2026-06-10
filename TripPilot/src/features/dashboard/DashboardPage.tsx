import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { useScrolled } from '@/hooks/useScrolled';
import { resolveActivePhase, getDayNumber, getTotalDays, formatDate, localDateString } from '@/domain/dates';
import { calculateFreeToSpend, createPoolSummary, calculateLastOutingSavings, buildHonestFriendV2 } from '@/domain/budget';
import { getRecentTransactions, filterTransactionsByPool, groupTransactionsByCategory, calculateSpentOnDate } from '@/domain/transactions';
import { formatMoney, fromCents, sumCents } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { useNavigate, useSearchParams } from 'react-router';
import { useNotifications } from '@/hooks/useNotifications';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import {
  transactionRepository,
  participantShareRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
  plannedOccurrenceRepository,
} from '@/data/repositories';
import { isProfileEnabledInPhase } from '@/domain/profiles';
import { calculateTodayFreeBudget } from '@/domain/phases';
import { calculatePoolSpent } from '@/domain/budget';
import { isOccurrenceActiveToday, postponeOccurrence } from '@/domain/planning';
import {
  findPendingConfirmationShares,
  calculateDebts,
  type PendingShareEntry,
} from '@/domain/splitting';
import { resolveShareConfirmation } from '@/domain/orchestrators';
import { BottomSheet } from '@/components/BottomSheet';
import {
  calculateOccasionForecasts,
  orderForecastsByUsage,
  type OccasionForecast,
} from '@/domain/forecasting';
import {
  buildDashboardInsights,
  createForecastSnapshot,
  type DashboardInsight,
} from '@/domain/insights';
import { calculateSessionTotal } from '@/domain/outing';
import { isBackupReminderDue } from '@/domain/backup';
import { settlementRepository, forecastSnapshotRepository } from '@/data/repositories';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Settlement } from '@/domain/types/settlement';

function splitMoneyDisplay(cents: number, currency: string): { symbol: string; integer: string; decimal: string } {
  const value = fromCents(cents);
  const abs = Math.abs(value);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  const symbolMap: Record<string, string> = { EUR: '€', USD: '$', BRL: 'R$', GBP: '£' };
  const symbol = symbolMap[currency] ?? currency;

  return {
    symbol,
    integer: `${symbol}${intPart}`,
    decimal: `,${decPart.toString().padStart(2, '0')}`,
  };
}

// DEC-077: icon + copy per insight kind (data-driven).
const INSIGHT_ICONS: Record<DashboardInsight['kind'], string> = {
  phase_projection: 'query_stats',
  rhythm_compare: 'speed',
  no_spend_streak: 'emoji_events',
  avg_outing_cost: 'local_bar',
  participant_balance: 'group',
  next_event: 'event',
};

function formatInsightText(
  insight: DashboardInsight,
  t: (key: string, options?: Record<string, string | number>) => string,
  currency: string,
): string {
  const v = insight.values;
  switch (insight.kind) {
    case 'phase_projection':
      return t(
        v.over ? 'dashboard.insight_projection_over' : 'dashboard.insight_projection_under',
        {
          projected: formatMoney(v.projectedCents as number, currency),
          diff: formatMoney(v.diffCents as number, currency),
        },
      );
    case 'rhythm_compare':
      return t(v.over ? 'dashboard.insight_rhythm_over' : 'dashboard.insight_rhythm_under', {
        real: formatMoney(v.realDailyCents as number, currency),
        planned: formatMoney(v.plannedDailyCents as number, currency),
      });
    case 'no_spend_streak':
      return t('dashboard.insight_no_spend', { count: v.days as number });
    case 'avg_outing_cost':
      return t('dashboard.insight_avg_outing', {
        amount: formatMoney(v.avgCents as number, currency),
        count: v.count as number,
      });
    case 'participant_balance':
      return t(
        v.owedToMe ? 'dashboard.insight_balance_owed' : 'dashboard.insight_balance_owing',
        {
          name: v.name as string,
          amount: formatMoney(v.amountCents as number, currency),
        },
      );
    case 'next_event':
      return t(
        v.hasReserve ? 'dashboard.insight_next_event' : 'dashboard.insight_next_event_no_reserve',
        {
          name: v.name as string,
          count: v.days as number,
          amount: formatMoney(v.reservedCents as number, currency),
        },
      );
  }
}

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { trip, phases, pools, links, envelopes, transactions, participants, occurrences, loading, settings, reload } = useAppData();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const [searchParams, setSearchParams] = useSearchParams();
  // DEC-090 (R-08): bell badge = active derived notifications.
  const { notifications } = useNotifications();

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [pendingShares, setPendingShares] = useState<PendingShareEntry[]>([]);
  const [allShares, setAllShares] = useState<ParticipantShare[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [shareDrafts, setShareDrafts] = useState<Record<string, string>>({});
  const [forecasts, setForecasts] = useState<OccasionForecast[]>([]);
  // DEC-091 (R-09): swipe carousel of insights + tap-to-detail sheet.
  const [insightIndex, setInsightIndex] = useState(0);
  const [detailInsight, setDetailInsight] = useState<DashboardInsight | null>(null);
  const [carouselPage, setCarouselPage] = useState(0);
  const insightScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trip) return;
    const load = async () => {
      const [sess, profs, completed] = await Promise.all([
        sessionRepository.getActive(trip.id),
        activityProfileRepository.getByTripId(trip.id),
        sessionRepository.getCompleted(trip.id),
      ]);
      setProfiles(profs);
      setCompletedSessions(completed);
      if (sess) {
        setActiveSession(sess);
        const txs = await transactionRepository.getBySessionId(sess.id);
        setSessionTxs(txs);
      } else {
        setActiveSession(null);
        setSessionTxs([]);
      }
    };
    load();
  }, [trip, transactions]);

  // DEC-071 (FIELD-03): pending = third-party shares awaiting confirmation.
  // The card disappears once every share is confirmed, regardless of netting.
  useEffect(() => {
    if (!trip) return;
    const owner = participants.find((p) => p.isOwner);
    if (!owner) {
      setPendingShares([]);
      return;
    }
    const load = async () => {
      const sharedTxIds = transactions
        .filter((tx) => tx.isShared && tx.deletedAt === null)
        .map((tx) => tx.id);
      const [shares, tripSettlements] = await Promise.all([
        participantShareRepository.getAllForTrip(sharedTxIds),
        settlementRepository.getByTripId(trip.id),
      ]);
      setAllShares(shares);
      setSettlements(tripSettlements);
      setPendingShares(findPendingConfirmationShares(transactions, shares, owner.id));
    };
    load();
  }, [trip, transactions, participants]);

  const owner = participants.find((p) => p.isOwner) ?? null;

  // DEC-090 (R-08): the notifications center deep-links into the confirm sheet.
  useEffect(() => {
    if (searchParams.get('confirmShares') && pendingShares.length > 0) {
      setConfirmSheetOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, pendingShares]);

  const handleResolveShare = async (shareId: string, status: 'confirmed' | 'rejected') => {
    if (!owner) return;
    const draft = shareDrafts[shareId];
    const parsed = draft !== undefined ? Number(draft.replace(',', '.')) : NaN;
    const adjustedAmountCents =
      status === 'confirmed' && Number.isFinite(parsed) && parsed > 0
        ? Math.round(parsed * 100)
        : null;
    await resolveShareConfirmation({ shareId, status, adjustedAmountCents, ownerId: owner.id });
    setShareDrafts((prev) => {
      const next = { ...prev };
      delete next[shareId];
      return next;
    });
    await reload();
  };

  // DEC-072 (M6.3): "Postpone" pushes the event's date interval +1 day.
  const handlePostponeEvent = async (occurrenceId: string) => {
    const occurrence = await plannedOccurrenceRepository.getById(occurrenceId);
    if (!occurrence) return;
    await plannedOccurrenceRepository.update(postponeOccurrence(occurrence));
    await reload();
  };

  // GAP-020 (DEC-006/043): counters show the forecast ("X remaining") from
  // the active scenario plan of the current phase.
  useEffect(() => {
    if (!trip || profiles.length === 0) {
      setForecasts([]);
      return;
    }
    const phase = resolveActivePhase(phases);
    const pool = pools.find((p) => p.scope === 'linked_phases');
    if (!phase || !pool) {
      setForecasts([]);
      return;
    }
    const load = async () => {
      const [plan, settings] = await Promise.all([
        scenarioPlanRepository.getActiveByPhaseAndPool(trip.id, phase.id, pool.id),
        phaseProfileSettingRepository.getByPhaseId(phase.id),
      ]);
      if (!plan) {
        setForecasts([]);
        return;
      }
      const allocations = await scenarioAllocationItemRepository.getByPlanId(plan.id);
      // DEC-074 (FIELD-01): counters only show profiles enabled in this phase.
      const enabledProfiles = profiles.filter((p) =>
        isProfileEnabledInPhase(settings, phase.id, p.id),
      );
      // DEC-076 (FIELD-06): used profiles first, then planned without use.
      setForecasts(
        orderForecastsByUsage(
          calculateOccasionForecasts(enabledProfiles, allocations, transactions, phase.id),
        ),
      );
    };
    load();
  }, [trip, phases, pools, profiles, transactions]);

  // DEC-077 (M8.3): persist ONE forecast snapshot per phase per day —
  // forecastSnapshots finally gets usage (history for the future sparkline).
  useEffect(() => {
    if (!trip) return;
    const phase = resolveActivePhase(phases);
    const pool = pools.find((p) => p.scope === 'linked_phases');
    if (!phase || !pool) return;
    const phaseTxs = transactions.filter(
      (tx) => tx.phaseId === phase.id && tx.deletedAt === null,
    );
    if (phaseTxs.length === 0) return;

    const persist = async () => {
      const todayDate = localDateString(new Date());
      const existing = await forecastSnapshotRepository.getByPhaseAndDate(phase.id, todayDate);
      if (existing) return;

      const snapshotFts = calculateFreeToSpend(
        pool,
        envelopes.filter((e) => e.budgetPoolId === pool.id),
        filterTransactionsByPool(transactions, pool.id),
        links.filter((l) => l.budgetPoolId === pool.id),
        phase.id,
        occurrences,
      );
      const spentCents = calculatePoolSpent(phaseTxs);
      const daysOfData = Math.max(1, getDayNumber(phase.startDate));
      const avgDailySpendCents = Math.round(spentCents / daysOfData);
      const totalDays = getTotalDays(phase.startDate, phase.endDate);

      await forecastSnapshotRepository.create(
        createForecastSnapshot({
          tripId: trip.id,
          phaseId: phase.id,
          snapshotDate: todayDate,
          totalBudgetCents: snapshotFts.totalBudgetCents,
          totalSpentCents: snapshotFts.totalSpentCents,
          freeToSpendCents: snapshotFts.freeToSpendCents,
          avgDailySpendCents,
          projectedEndSpendCents: avgDailySpendCents * totalDays,
          daysOfData,
        }),
      );
    };
    persist();
  }, [trip, phases, pools, envelopes, links, transactions, occurrences]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-on-surface-dim">{t('common.loading')}</p>
      </div>
    );
  }

  if (!trip || !settings?.onboardingCompleted) {
    navigate('/welcome');
    return null;
  }

  const activePhase = resolveActivePhase(phases);
  const dayNum = activePhase ? getDayNumber(activePhase.startDate) : null;
  const recent = getRecentTransactions(transactions, 5);

  const linkedPools = pools.filter((p) => p.scope === 'linked_phases');
  const primaryPool = linkedPools[0];
  const fts = primaryPool && activePhase
    ? calculateFreeToSpend(
        primaryPool,
        envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
        filterTransactionsByPool(transactions, primaryPool.id),
        links.filter((l) => l.budgetPoolId === primaryPool.id),
        activePhase.id,
        occurrences,
      )
    : null;

  const categoryGroups = groupTransactionsByCategory(transactions);
  const barCount = categoryGroups['bar']?.length ?? 0;
  const marketCount = categoryGroups['market']?.length ?? 0;
  const restaurantCount = categoryGroups['restaurant']?.length ?? 0;
  const hasOccasionData = barCount > 0 || marketCount > 0 || restaurantCount > 0;

  // DEC-072 (M6.3): today's planned events of the active phase (day card).
  // Local date, not UTC — toISOString() would skip to tomorrow after 21:00 in UTC-3.
  const todayIso = localDateString(new Date());
  const todayEvents = activePhase
    ? occurrences.filter(
        (o) => o.phaseId === activePhase.id && isOccurrenceActiveToday(o, todayIso),
      )
    : [];

  const hasPendingExpenses = pendingShares.length > 0;
  const pendingImpactCents = pendingShares.reduce((sum, entry) => sum + entry.share.shareAmountCents, 0);
  const participantNameById = new Map(participants.map((p) => [p.id, p.nickname ?? p.name]));

  // DEC-077 (FIELD-07): rotating insights — only significant cards, max 4/day.
  const phaseTxsForInsights = activePhase
    ? transactions.filter((tx) => tx.phaseId === activePhase.id && tx.deletedAt === null)
    : [];
  const completedOutingTotalsCents = activePhase
    ? completedSessions
        .filter((s) => s.phaseId === activePhase.id)
        .map((s) => calculateSessionTotal(transactions.filter((tx) => tx.sessionId === s.id)))
    : [];
  const debts = owner
    ? calculateDebts(transactions, allShares, participants, settlements, owner.id).debts
    : [];
  const insights =
    activePhase && fts && owner
      ? buildDashboardInsights({
          todayDate: localDateString(new Date()),
          phase: activePhase,
          phaseTransactions: phaseTxsForInsights,
          phaseBudgetCents: fts.freeToSpendCents + calculatePoolSpent(phaseTxsForInsights),
          completedOutingTotalsCents,
          debts,
          ownerId: owner.id,
          occurrences,
        })
      : [];
  // DEC-091 (R-09): tap opens the CONTENT of each insight — calculation
  // detail for projections, the right screen for the others.
  const handleInsightTap = (insight: DashboardInsight) => {
    switch (insight.kind) {
      case 'avg_outing_cost':
        navigate('/expenses?tab=outings');
        return;
      case 'participant_balance':
        navigate('/shared');
        return;
      case 'next_event':
        navigate(`/trip/edit?occurrence=${insight.values.occurrenceId}`);
        return;
      default:
        setDetailInsight(insight);
    }
  };

  // Global pools (e.g. personal shopping) are detected by scope, not by name (GAP-017).
  const globalPools = pools.filter((p) => p.scope === 'global' && p.deletedAt === null);
  const globalPoolSummaries = globalPools.map((pool) => ({
    pool,
    summary: createPoolSummary(pool, filterTransactionsByPool(transactions, pool.id)),
  }));

  const progressPercent = fts && fts.totalBudgetCents > 0
    ? Math.round((fts.totalSpentCents / fts.totalBudgetCents) * 100)
    : 0;

  const heroMoney = fts ? splitMoneyDisplay(fts.freeToSpendCents, trip.baseCurrency) : null;

  // DEC-088 (R-06): subtractive "free to use today" — allowance fixed at day
  // start minus what was spent today. Spending €2 drops the number by €2.
  const todaySpentCents = primaryPool
    ? calculateSpentOnDate(filterTransactionsByPool(transactions, primaryPool.id), todayIso)
    : 0;
  const todayBudget =
    fts && activePhase
      ? calculateTodayFreeBudget(fts.freeToSpendCents, todaySpentCents, activePhase, todayIso)
      : null;

  // DEC-092 (R-10): savings refer to the LAST closed outing, with the typical
  // value as an explicit reference — never a trip-wide claim.
  const savings = calculateLastOutingSavings(completedSessions, transactions, profiles, Date.now());

  // DEC-093 (R-11): Honest Friend v2 — based on the PLAN of the category of
  // the most recent profiled expense, never on balance ÷ typical cost.
  const recentProfileTx =
    [...phaseTxsForInsights]
      .filter((tx) => tx.type === 'expense' && tx.activityProfileId !== null)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const amigoProfile = recentProfileTx
    ? profiles.find((p) => p.id === recentProfileTx.activityProfileId) ?? null
    : null;
  const amigoForecast = amigoProfile
    ? forecasts.find((f) => f.profileId === amigoProfile.id) ?? null
    : null;
  const phaseSpentCents = calculatePoolSpent(phaseTxsForInsights);
  const amigoV2 =
    activePhase && fts && amigoProfile && recentProfileTx
      ? buildHonestFriendV2({
          profileId: amigoProfile.id,
          profileName: amigoProfile.name,
          typicalValueCents: amigoProfile.typicalValueCents,
          plannedQuantity: amigoForecast?.totalPlanned ?? 0,
          doneQuantity: amigoForecast?.spent ?? 0,
          categorySpentCents: sumCents(
            phaseTxsForInsights
              .filter(
                (tx) => tx.activityProfileId === amigoProfile.id && tx.type === 'expense',
              )
              .map((tx) => tx.personalCostCents ?? tx.amountCents),
          ),
          recentSpendCents: recentProfileTx.personalCostCents ?? recentProfileTx.amountCents,
          freeToSpendCents: fts.freeToSpendCents,
          phaseSpentCents,
          phaseBudgetCents: fts.freeToSpendCents + phaseSpentCents,
          todayDate: todayIso,
          phase: activePhase,
        })
      : ({ kind: 'none' } as const);

  const sessionTotalCents = sumCents(sessionTxs.filter((t) => t.deletedAt === null).map((t) => t.amountCents));
  const sessionDrinksLeft = activeSession?.ceilingCents && activeSession?.avgDrinkPriceCents
    ? Math.floor(Math.max(0, (activeSession.ceilingCents - sessionTotalCents)) / activeSession.avgDrinkPriceCents)
    : null;

  const sessionProfile = activeSession
    ? profiles.find((p) => p.id === activeSession.activityProfileId) ?? null
    : null;
  const sessionIcon = sessionProfile?.iconName ?? getCategoryIcon(sessionProfile?.category ?? 'bar');

  return (
    <div className="flex flex-col pb-6">
      {/* DEMO BANNER */}
      {settings.isDemo && (
        <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/30">
          <p className="text-xs font-semibold text-warning">{t('demo.banner')}</p>
        </div>
      )}

      {/* BACKUP REMINDER (DEC-057 / decision D-J) — discreet, tap → backup */}
      {isBackupReminderDue(settings, Date.now()) && transactions.length > 0 && (
        <button
          onClick={() => navigate('/settings/backup')}
          className="mt-4 p-3 rounded-xl flex items-center gap-2.5 btn-press text-left"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--border-faint)' }}
        >
          <Icon name="cloud_upload" size={16} className="text-on-surface-dim" />
          <p className="text-xs font-semibold text-on-surface-dim flex-1">
            {settings.lastBackupDate
              ? t('dashboard.backup_reminder', { days: settings.backupReminderDays })
              : t('dashboard.backup_reminder_never')}
          </p>
          <Icon name="chevron_right" size={14} className="text-on-surface-faint" />
        </button>
      )}

      {/* HEADER — DEC-084 (R-01): fixed at the top, content scrolls beneath */}
      {activePhase && dayNum !== null && (
        <div
          className={`page-sticky-header ${scrolled ? 'is-scrolled' : ''} pt-6 pb-2 flex justify-between items-center`}
        >
          {/* DEC-060 (GAP-024): phase name navigates to the trip overview */}
          <button onClick={() => navigate('/trip')} className="text-left btn-press">
            <p
              className="text-[11px] tracking-[0.15em] uppercase font-bold"
              style={{ color: '#C75B39aa' }}
            >
              {t('dashboard.day_counter', {
                current: dayNum,
                end: formatDate(activePhase.endDate, "d 'de' MMMM"),
              })}
            </p>
            <h1 className="text-xl font-extrabold tracking-tight mt-1 text-on-surface">
              {activePhase.name || trip.name}
            </h1>
          </button>
          {/* DEC-090 (R-08): bell opens the notifications center — never /shared */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative btn-press"
            aria-label={t('notifications.title')}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-container)' }}
            >
              <Icon name="notifications" size={20} className="text-primary" />
            </div>
            {notifications.length > 0 && (
              <div
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                style={{ background: 'var(--primary)' }}
              >
                <span className="text-[9px] font-extrabold" style={{ color: 'var(--surface)' }}>
                  {notifications.length}
                </span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* §7 pos. 3 — DEC-072 (M6.3): DAY CARD — today's planned events without a session */}
      {todayEvents.map((occ) => (
        <div
          key={occ.id}
          className="mt-4 p-4 rounded-2xl"
          style={{ background: 'var(--surface-deep)', border: '1px solid var(--border-faint)' }}
        >
          {/* DEC-101 (R-23): tapping the event opens ITS edit sheet */}
          <button
            className="flex items-center gap-2.5 w-full text-left btn-press"
            onClick={() => navigate(`/trip/edit?occurrence=${occ.id}`)}
          >
            <Icon
              name={occ.kind === 'sub_destination' ? 'location_on' : 'celebration'}
              size={20}
              filled
              className="text-primary"
            />
            <p className="text-sm font-extrabold text-on-surface flex-1 truncate">
              {t('dashboard.event_today', { name: occ.name })}
            </p>
            {occ.reservedCents !== null && (
              <span className="text-xs font-bold tabular text-on-surface-dim">
                {t('dashboard.event_reserved', {
                  amount: formatMoney(occ.reservedCents, trip.baseCurrency),
                })}
              </span>
            )}
          </button>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => navigate(`/outings/new?occurrence=${occ.id}`)}
              className="flex-1 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
            >
              {t('dashboard.event_start_now')}
            </button>
            <button
              onClick={() => handlePostponeEvent(occ.id)}
              className="flex-1 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
            >
              {t('dashboard.event_postpone')}
            </button>
          </div>
        </div>
      ))}

      {/* §7 pos. 4 — ACTIVE OUTING CARD */}
      {activeSession && (
        <button
          onClick={() => navigate('/outings/active')}
          className="mt-4 p-4 rounded-2xl flex items-center gap-4 btn-press text-left"
          style={{ background: 'var(--surface-deep)', border: '1px solid #C75B3925' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#C75B3925' }}
          >
            <Icon name={sessionIcon} size={24} filled className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-primary">
              {t('dashboard.active_outing')} · {formatElapsed(activeSession.startedAt)}
            </p>
            <p className="text-base font-extrabold mt-0.5 text-on-surface truncate">
              {activeSession.name}
            </p>
            <p className="text-xs font-semibold mt-0.5 text-on-surface-dim">
              {t('dashboard.active_outing_spent', { amount: formatMoney(sessionTotalCents, trip.baseCurrency) })}
              {sessionDrinksLeft !== null && ` · ${t('dashboard.session_drinks_left', { count: sessionDrinksLeft })}`}
            </p>
          </div>
          <span
            className="px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            {t('dashboard.active_outing_open')}
          </span>
        </button>
      )}

      {/* §7 pos. 5 — HERO CARD */}
      {fts && heroMoney && (
        <div className="mt-5 p-5 rounded-2xl bg-surface-container">
          <p
            className="text-xs font-bold"
            style={{ color: '#C75B39aa' }}
          >
            {t('dashboard.free_to_spend', {
              date: activePhase ? formatDate(activePhase.endDate, "d 'de' MMMM") : '',
            })}
          </p>
          <p className="text-[44px] font-extrabold tracking-tight leading-none mt-2 tabular text-on-surface">
            {heroMoney.integer}
            <span className="text-xl font-bold text-on-surface-dim">{heroMoney.decimal}</span>
          </p>
          {todayBudget && todayBudget.todayAllowanceCents > 0 && (
            <>
              <p
                className={`text-xs font-bold mt-1.5 ${
                  todayBudget.freeTodayCents < 0
                    ? 'text-error'
                    : todayBudget.isPeakDay
                      ? 'text-warning'
                      : 'text-on-surface-dim'
                }`}
              >
                {todayBudget.isPeakDay
                  ? t('dashboard.peak_day_free', {
                      amount: formatMoney(todayBudget.freeTodayCents, trip.baseCurrency),
                    })
                  : t('dashboard.free_per_day', {
                      amount: formatMoney(todayBudget.freeTodayCents, trip.baseCurrency),
                    })}
              </p>
              {/* DEC-088: the recalculated average becomes a secondary, named metric */}
              <p className="text-[11px] font-semibold mt-0.5 text-on-surface-faint">
                {t('dashboard.avg_daily_until_end', {
                  amount: formatMoney(todayBudget.avgDailyUntilEndCents, trip.baseCurrency),
                })}
              </p>
            </>
          )}
          <div
            className="w-full h-2 rounded-full overflow-hidden mt-4"
            style={{ background: 'var(--surface-container-high)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, progressPercent)}%`,
                background: 'linear-gradient(90deg, var(--success), var(--primary))',
              }}
            />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.fund_balance')}</span>
              <span className="text-xs font-bold tabular text-on-surface-dim">
                {formatMoney(fts.totalBudgetCents - fts.totalSpentCents, trip.baseCurrency)}
              </span>
            </div>
            {/* DEC-089 (R-07): "Reservado para [próx. fase]" removed from the hero —
                each phase has its own fund; future floor stays in Funds/Planner. */}
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.protected_reserve')}</span>
              <span className="text-xs font-bold tabular text-on-surface-faint">
                {formatMoney(fts.protectedReserveCents, trip.baseCurrency)}
              </span>
            </div>
            {/* DEC-072: active event reserves deduct from freeToSpend */}
            {fts.eventReservesCents > 0 && (
              <div className="flex justify-between">
                <span className="text-xs font-semibold text-on-surface-dim">
                  {t('dashboard.reserved_events')}
                </span>
                <span className="text-xs font-bold tabular" style={{ color: 'var(--primary-dim)' }}>
                  {formatMoney(fts.eventReservesCents, trip.baseCurrency)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* §7 pos. 6 — OCCASION COUNTERS — carousel (DEC-076), done-count fallback */}
      {forecasts.length > 0 ? (
        <div className="mt-4">
          {/* DEC-076: pure-CSS scroll-snap carousel, ~3 visible, all enabled profiles */}
          <div
            className="flex gap-3 overflow-x-auto no-scrollbar -mx-[var(--page-padding-x)] px-[var(--page-padding-x)] snap-x snap-mandatory"
            onScroll={(e) => {
              const el = e.currentTarget;
              const pageCount = Math.ceil(forecasts.length / 3);
              const maxScroll = el.scrollWidth - el.clientWidth;
              if (maxScroll <= 0) return;
              const page = Math.round((el.scrollLeft / maxScroll) * (pageCount - 1));
              if (page !== carouselPage) setCarouselPage(page);
            }}
          >
            {forecasts.map((forecast) => {
              const profile = profiles.find((p) => p.id === forecast.profileId);
              return (
                <div key={forecast.profileId} className="snap-start shrink-0 w-[30%] min-w-[104px] flex">
                  <OccasionCounter
                    icon={profile?.iconName ?? getCategoryIcon(profile?.category ?? 'other')}
                    count={forecast.remaining}
                    label={t('dashboard.occasion_remaining', { name: forecast.profileName })}
                    sublabel={t('dashboard.occasion_done', { count: forecast.spent })}
                    iconBg="#C75B3918"
                    iconColor="var(--primary)"
                    onClick={() => navigate(`/expenses?profile=${forecast.profileId}`)}
                  />
                </div>
              );
            })}
          </div>
          {forecasts.length > 3 && (
            <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
              {Array.from({ length: Math.ceil(forecasts.length / 3) }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: i === carouselPage ? 'var(--primary)' : 'var(--surface-container-high)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : hasOccasionData ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <OccasionCounter
            icon="local_bar"
            count={barCount}
            label={t('dashboard.occasion_bar')}
            iconBg="#C75B3918"
            iconColor="var(--primary)"
            onClick={() => navigate('/expenses?category=bar')}
          />
          <OccasionCounter
            icon="shopping_cart"
            count={marketCount}
            label={t('dashboard.occasion_market')}
            iconBg="#6B8F7118"
            iconColor="var(--success)"
            onClick={() => navigate('/expenses?category=market')}
          />
          <OccasionCounter
            icon="restaurant"
            count={restaurantCount}
            label={t('dashboard.occasion_restaurant')}
            iconBg="#D4A84318"
            iconColor="var(--warning)"
            onClick={() => navigate('/expenses?category=restaurant')}
          />
        </div>
      ) : null}

      {/* §7 pos. 7 — INSIGHTS (DEC-091 / R-09): swipe switches, tap details */}
      {insights.length > 0 && (
        <div className="mt-4 rounded-2xl bg-surface-container pb-1">
          <div
            ref={insightScrollRef}
            className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.clientWidth === 0) return;
              const idx = Math.round(el.scrollLeft / el.clientWidth);
              if (idx !== insightIndex) setInsightIndex(idx);
            }}
          >
            {insights.map((insight) => (
              <button
                key={insight.kind}
                onClick={() => handleInsightTap(insight)}
                className="w-full shrink-0 snap-center p-4 text-left btn-press flex items-start gap-3"
              >
                <Icon
                  name={INSIGHT_ICONS[insight.kind]}
                  size={18}
                  className={
                    insight.tone === 'positive'
                      ? 'text-success'
                      : insight.tone === 'warning'
                        ? 'text-warning'
                        : 'text-primary'
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
                    {t('dashboard.insights_title')}
                  </p>
                  <p className="text-[13px] font-semibold leading-snug mt-1 text-on-surface">
                    {formatInsightText(insight, t, trip.baseCurrency)}
                  </p>
                </div>
                <Icon name="chevron_right" size={14} className="text-on-surface-faint mt-1" />
              </button>
            ))}
          </div>
          {insights.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-2">
              {insights.map((insight, i) => (
                <button
                  key={insight.kind}
                  onClick={() =>
                    insightScrollRef.current?.scrollTo({
                      left: i * insightScrollRef.current.clientWidth,
                      behavior: 'smooth',
                    })
                  }
                  aria-label={`${t('dashboard.insights_title')} ${i + 1}`}
                  className="p-1 btn-press"
                >
                  <span
                    className="block w-1.5 h-1.5 rounded-full"
                    style={{
                      background:
                        i === Math.min(insightIndex, insights.length - 1)
                          ? 'var(--primary)'
                          : 'var(--surface-container-high)',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SAVINGS CARD — DEC-092 (R-10): cites the specific outing + reference */}
      {savings.hasSavings && (
        <div
          className="mt-3 p-3.5 rounded-2xl flex items-center gap-3"
          style={{ background: '#6B8F7112', border: '1px solid #6B8F7118' }}
        >
          <Icon name="trending_up" className="text-success" />
          <p className="text-sm font-semibold text-success">
            {t('dashboard.savings_last_outing', {
              profile: savings.profileName.toLowerCase(),
              spent: formatMoney(savings.spentCents, trip.baseCurrency),
              saved: formatMoney(savings.savedCents, trip.baseCurrency),
              typical: formatMoney(savings.typicalCents, trip.baseCurrency),
            })}
          </p>
        </div>
      )}

      {/* §7 pos. 8 — AMIGO SINCERO v2 (DEC-093 / R-11): plan-based, never
          balance ÷ typical. "Ver impacto completo" opens the detail — NOT
          the simulator. */}
      {amigoV2.kind !== 'none' && (
        <div
          className="mt-5 p-4 rounded-2xl"
          style={{ background: '#C75B3910', border: '1px solid #C75B3918' }}
        >
          <div className="flex items-start gap-3">
            <Icon name="chat_bubble" className="text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-primary">{t('dashboard.amigo_sincero')}</p>
              <p className="text-[13px] mt-1.5 leading-snug font-semibold text-on-surface">
                {amigoV2.kind === 'over_pace' &&
                  t('dashboard.amigo_over_pace', {
                    planned: amigoV2.plannedQuantity,
                    type: amigoV2.profileName.toLowerCase(),
                    fit: amigoV2.fitCount,
                    remaining: amigoV2.remainingPlanned,
                  })}
                {amigoV2.kind === 'on_plan' &&
                  t('dashboard.amigo_on_plan', {
                    type: amigoV2.profileName.toLowerCase(),
                    done: amigoV2.doneQuantity,
                    planned: amigoV2.plannedQuantity,
                  })}
                {amigoV2.kind === 'no_plan' &&
                  t('dashboard.amigo_no_plan', {
                    type: amigoV2.profileName.toLowerCase(),
                    percent: amigoV2.impactPercent,
                  })}
              </p>
              {amigoV2.kind === 'over_pace' && amigoV2.reserveStartDate && (
                <p className="text-xs font-bold text-warning mt-2">
                  {t('dashboard.amigo_reserve_date', {
                    date: formatDate(amigoV2.reserveStartDate, "d 'de' MMMM"),
                  })}
                </p>
              )}
              <button
                onClick={() => navigate('/impact')}
                className="btn-press mt-3 px-4 py-2 rounded-lg text-xs font-bold"
                style={{ background: '#C75B3918', color: 'var(--primary)' }}
              >
                {t('dashboard.amigo_see_impact')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* §7 pos. 9 — PENDING SHARE CONFIRMATIONS (DEC-071 / FIELD-03) */}
      {hasPendingExpenses && (
        <button
          onClick={() => setConfirmSheetOpen(true)}
          className="mt-4 p-4 rounded-2xl flex items-center gap-3 btn-press text-left"
          style={{ background: '#D4A84312', border: '1px solid #D4A84320' }}
        >
          <Icon name="group" className="text-warning" />
          <div className="flex-1">
            <p className="text-sm font-bold text-warning">
              {t('dashboard.pending_confirmation', { count: pendingShares.length })}
            </p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#D4A843aa' }}>
              {t('dashboard.pending_impact', { amount: formatMoney(pendingImpactCents, trip.baseCurrency) })}
            </p>
          </div>
          <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
        </button>
      )}

      {/* Confirmation sheet: confirm / reject / adjust value per share */}
      <BottomSheet
        open={confirmSheetOpen}
        onClose={() => setConfirmSheetOpen(false)}
        title={t('shared.confirm_sheet_title')}
      >
        <div className="flex flex-col gap-3">
          {pendingShares.length === 0 && (
            <p className="text-sm text-on-surface-dim text-center py-4">
              {t('shared.confirm_all_done')}
            </p>
          )}
          {pendingShares.map(({ share, transaction }) => {
            const draft = shareDrafts[share.id] ?? (share.shareAmountCents / 100).toFixed(2);
            return (
              <div key={share.id} className="bg-surface-high rounded-xl p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{transaction.description}</p>
                    <p className="text-xs text-on-surface-faint mt-0.5">
                      {t('shared.confirm_share_of', {
                        name: participantNameById.get(share.participantId) ?? '—',
                        total: formatMoney(transaction.amountCents, transaction.currency),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-baseline gap-1 bg-surface-container rounded-lg px-3 py-2 flex-1">
                    <span className="text-on-surface-faint text-xs">{transaction.currency}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={draft}
                      onChange={(e) =>
                        setShareDrafts((prev) => ({ ...prev, [share.id]: e.target.value }))
                      }
                      className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
                      aria-label={t('shared.adjust_value')}
                    />
                  </div>
                  <button
                    onClick={() => handleResolveShare(share.id, 'rejected')}
                    className="px-3 py-2 rounded-lg text-xs font-bold btn-press bg-error/15 text-error"
                  >
                    {t('shared.reject')}
                  </button>
                  <button
                    onClick={() => handleResolveShare(share.id, 'confirmed')}
                    className="px-3 py-2 rounded-lg text-xs font-bold btn-press bg-success/20 text-success"
                  >
                    {t('shared.confirm')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* DEC-091 (R-09): "how we got here" — open calculation of the insight */}
      <BottomSheet
        open={detailInsight !== null}
        onClose={() => setDetailInsight(null)}
        title={t('dashboard.insight_detail_title')}
      >
        {detailInsight && (
          <InsightDetail insight={detailInsight} currency={trip.baseCurrency} />
        )}
      </BottomSheet>

      {/* GLOBAL POOLS (personal shopping etc. — by scope, GAP-017) */}
      {/* R-26: pool cards lead to the funds screen */}
      {globalPoolSummaries.map(({ pool, summary }) => (
        <button
          key={pool.id}
          onClick={() => navigate('/funds')}
          className="mt-5 p-4 rounded-2xl bg-surface-container w-full text-left btn-press"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#C75B3918' }}
            >
              <Icon name="shopping_bag" size={18} className="text-primary" />
            </div>
            <p className="text-sm font-bold text-on-surface">{pool.name}</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[32px] font-extrabold tracking-tight leading-none tabular text-on-surface">
                {formatMoney(summary.remainingCents, pool.currency)}
              </p>
              <p className="text-[11px] font-semibold mt-1 text-on-surface-dim">{t('dashboard.remaining')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-on-surface-faint">
                {t('dashboard.used_of', {
                  used: formatMoney(summary.spentCents, pool.currency),
                  total: formatMoney(summary.totalCents, pool.currency),
                })}
              </p>
              <div
                className="w-28 h-2 rounded-full overflow-hidden mt-1.5"
                style={{ background: 'var(--surface-container-high)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, summary.percentUsed)}%`,
                    background: 'var(--primary)',
                  }}
                />
              </div>
            </div>
          </div>
        </button>
      ))}

      {/* §7 pos. 10 — RECENT EXPENSES */}
      {recent.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-on-surface">
              {t('dashboard.recent_expenses')}
            </p>
            <button
              onClick={() => navigate('/expenses')}
              className="text-xs text-primary btn-press font-bold"
            >
              {t('common.view_all')}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {/* FIELD-13: recent items navigate to the expense detail */}
            {recent.map((tx) => (
              <button
                key={tx.id}
                onClick={() => navigate(`/expenses/${tx.id}`)}
                className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full"
              >
                <div>
                  <p className="text-sm text-on-surface font-semibold">{tx.description}</p>
                  <p className="text-xs text-on-surface-faint">
                    {tx.category ? t(`categories.${tx.category}` as never) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold tabular text-on-surface">
                    {formatMoney(tx.amountCents, tx.currency)}
                  </p>
                  <Icon name="chevron_right" size={14} className="text-on-surface-faint" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {recent.length === 0 && (
        <div className="mt-5">
          <div className="bg-surface-container rounded-xl p-6 text-center">
            <Icon name="receipt_long" size={32} className="text-on-surface-mute mx-auto mb-2" />
            <p className="text-sm text-on-surface-dim">{t('dashboard.no_expenses')}</p>
            <p className="text-xs text-on-surface-faint mt-1">{t('dashboard.no_expenses_desc')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────── DEC-091 (R-09): insight calculation detail ──────────────── */

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: 'warning' | 'success' }) {
  return (
    <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
      <span className="text-xs font-semibold text-on-surface-dim">{label}</span>
      <span
        className={`text-sm font-bold tabular ${
          accent === 'warning' ? 'text-warning' : accent === 'success' ? 'text-success' : 'text-on-surface'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function InsightDetail({ insight, currency }: { insight: DashboardInsight; currency: string }) {
  const { t } = useTranslation();
  const v = insight.values;

  if (insight.kind === 'phase_projection') {
    const over = (v.over as number) === 1;
    return (
      <div className="flex flex-col">
        <p className="text-[13px] font-semibold leading-snug text-on-surface mb-2">
          {formatInsightText(insight, t, currency)}
        </p>
        <DetailRow label={t('dashboard.detail_spent_so_far')} value={formatMoney(v.spentCents as number, currency)} />
        <DetailRow label={t('dashboard.detail_days_elapsed')} value={String(v.daysElapsed)} />
        <DetailRow label={t('dashboard.detail_daily_pace')} value={formatMoney(v.perDayCents as number, currency)} />
        <DetailRow label={t('dashboard.detail_days_remaining')} value={String(v.daysRemaining)} />
        <DetailRow label={t('dashboard.detail_projected_total')} value={formatMoney(v.projectedCents as number, currency)} />
        <DetailRow label={t('dashboard.detail_phase_budget')} value={formatMoney(v.budgetCents as number, currency)} />
        <DetailRow
          label={t(over ? 'dashboard.detail_over_by' : 'dashboard.detail_under_by')}
          value={formatMoney(v.diffCents as number, currency)}
          accent={over ? 'warning' : 'success'}
        />
        <p className="text-[11px] text-on-surface-faint mt-3 leading-relaxed">
          {t('dashboard.detail_projection_explainer')}
        </p>
      </div>
    );
  }

  if (insight.kind === 'rhythm_compare') {
    const over = (v.over as number) === 1;
    return (
      <div className="flex flex-col">
        <p className="text-[13px] font-semibold leading-snug text-on-surface mb-2">
          {formatInsightText(insight, t, currency)}
        </p>
        <DetailRow
          label={t('dashboard.detail_real_daily')}
          value={formatMoney(v.realDailyCents as number, currency)}
          accent={over ? 'warning' : 'success'}
        />
        <DetailRow label={t('dashboard.detail_planned_daily')} value={formatMoney(v.plannedDailyCents as number, currency)} />
        <p className="text-[11px] text-on-surface-faint mt-3 leading-relaxed">
          {t('dashboard.detail_rhythm_explainer')}
        </p>
      </div>
    );
  }

  // no_spend_streak
  return (
    <div className="flex flex-col">
      <p className="text-[13px] font-semibold leading-snug text-on-surface mb-2">
        {formatInsightText(insight, t, currency)}
      </p>
      <DetailRow label={t('dashboard.detail_streak_days')} value={String(v.days)} accent="success" />
      <p className="text-[11px] text-on-surface-faint mt-3 leading-relaxed">
        {t('dashboard.detail_streak_explainer')}
      </p>
    </div>
  );
}

// FIELD-14: counters navigate to the expense list pre-filtered by profile/category.
function OccasionCounter({
  icon,
  count,
  label,
  sublabel,
  iconBg,
  iconColor,
  onClick,
}: {
  icon: string;
  count: number;
  label: string;
  sublabel?: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}) {
  // DEC-085 (R-03): identical card height — 2-line space reserved for the name.
  return (
    <button
      onClick={onClick}
      className="p-3.5 rounded-2xl text-center bg-surface-container btn-press w-full h-full flex flex-col items-center"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5 shrink-0"
        style={{ background: iconBg }}
      >
        <Icon name={icon} size={18} style={{ color: iconColor }} />
      </div>
      <p className="text-xl font-extrabold tabular text-on-surface">{count}</p>
      <p className="text-[10px] font-bold text-on-surface-dim leading-[13px] min-h-[26px] line-clamp-2 flex items-center justify-center">
        {label}
      </p>
      <p className="text-[9px] font-semibold text-on-surface-faint mt-0.5 min-h-[12px]">
        {sublabel ?? ''}
      </p>
    </button>
  );
}
