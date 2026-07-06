import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { useTabPaging } from '@/hooks/useTabPaging';
import { sortPhasesByOrder, findActivePhase, formatDate, getDayNumber, getTotalDays } from '@/domain/dates';
import {
  calculateTotalSpent,
  calculateFreeToSpend,
  createPoolSummary,
  selectActivePhasePool,
  computeTripBudgetTotals,
  summarizeTrechoBalance,
  isPotInPhase,
} from '@/domain/budget';
import { filterTransactionsByPhase, filterTransactionsByPool } from '@/domain/transactions';
import { calculatePlanProgress, type PlanProgress } from '@/domain/forecasting';
import { isProfileEnabledInPhase } from '@/domain/profiles';
import { formatMoney } from '@/domain/money';
import {
  isPlannedPurchaseOpen,
  plannedPurchaseReservedRemainingCents,
} from '@/domain/planning/planned-purchases';
import { buildShareCardStats } from '@/domain/sharing';
import { renderShareCard, deliverShareCard, shareOutcomeToast } from '@/utils/share-card';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { AddTrechoSheet, RemanejarSheet } from './TrechoSheets';
import { PlanExpenseSheet } from './PlanExpenseSheet';
import type { BudgetPool } from '@/domain/types/budget-pool';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
  groupSplitRepository,
} from '@/data/repositories';
import type { ActivityProfile } from '@/domain/types/activity-profile';

type Selection = string | 'all';

interface StructureItem {
  icon: string;
  label: string;
  path: string;
  /** DEC-360: optional count chip (e.g. active group divisions). */
  badge?: number;
}

/**
 * Redesign (G2): "Viagem" is the plan/structure hub. A single phase selector
 * sets the context: "Todas" shows the cross-phase overview (every phase, tap to
 * drill in); a specific phase filters the whole page to that phase (free-to-
 * spend, the scenario plan preview, its funds). This kills the old redundancy
 * of a filter PLUS a "phases" list both visible at once. Nothing is lost — only
 * reorganized; every destination still has a tile under "Estrutura".
 */
export function TripHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, links, envelopes, transactions, occurrences, plannedPurchases, reload } =
    useAppData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedPhaseId, setSelectedPhaseId] = useState<Selection | null>(null);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  // DEC-477: the same plan-progress ruler as Home/Planner (windowed + scoped).
  const [planProgress, setPlanProgress] = useState<PlanProgress | null>(null);
  // DEC-360 (G9): the count behind the first-level "Divisões em grupo (N)" tile —
  // discovery of group splits without a second list (the list stays at /groups).
  const [groupCount, setGroupCount] = useState(0);
  const [addTrechoOpen, setAddTrechoOpen] = useState(false);
  // GATE 4 (master §3.3/§6): the single "Planejar um gasto" door. The FAB deep-
  // links here with ?plan=1; the section CTA opens it directly.
  const [planExpenseOpen, setPlanExpenseOpen] = useState(searchParams.get('plan') === '1');
  const [remanejarTarget, setRemanejarTarget] = useState<{ pool: BudgetPool; suggestedCents: number } | null>(
    null,
  );
  // DEC-288: the shareable summary card was the only exclusive content of the
  // retired /trip overview; it now lives in this hub header.
  const [sharing, setSharing] = useState(false);

  const sortedPhases = useMemo(() => sortPhasesByOrder(phases), [phases]);
  const activePhaseId = useMemo(() => findActivePhase(phases)?.id ?? null, [phases]);
  // Default to the current phase (most actionable); fall back to "all". Using a
  // derived value (not an effect) keeps it correct even if phases load late.
  const selected: Selection = selectedPhaseId ?? activePhaseId ?? 'all';
  // DEC-462: the SELECTED phase's own fund. The old `pools.find(linked_phases)`
  // grabbed the trip's FIRST fund, so the plan preview below queried a pool the
  // Planner never wrote to and the "Plano desta fase" read as zeroed.
  const primaryPool = useMemo(
    () => selectActivePhasePool(pools, links, selected === 'all' ? activePhaseId : selected),
    [pools, links, selected, activePhaseId],
  );

  // G1: swipe left/right to page through the phase selector ("Todas" → phases in
  // order). Clamped at the ends (cross-section swipe is a separate experiment).
  const phaseSequence = useMemo<Selection[]>(
    () => ['all', ...sortedPhases.map((p) => p.id)],
    [sortedPhases],
  );
  // DEC-197 (N3): central phase selector — records the slide direction so the
  // keyed content pane animates in from the matching side, for both swipe and
  // tap. Bidirectional and clamped at the ends.
  const phaseDirRef = useRef<'next' | 'prev'>('next');
  const selectPhase = (next: Selection) => {
    setSelectedPhaseId((cur) => {
      const curSel: Selection = cur ?? activePhaseId ?? 'all';
      if (next === curSel) return cur;
      phaseDirRef.current =
        phaseSequence.indexOf(next) > phaseSequence.indexOf(curSel) ? 'next' : 'prev';
      return next;
    });
  };
  // FIELD-02: at the ends of the phase sequence the swipe hands off to the
  // neighbouring app tab (first ⇠ Gastos · last ⇢ Copiloto when visible).
  const tabPaging = useTabPaging();
  const phaseSwipe = useHorizontalSwipe({
    onSwipeLeft: () => {
      const next = phaseSequence[phaseSequence.indexOf(selected) + 1];
      if (next !== undefined) selectPhase(next);
      else tabPaging.goNextTab();
    },
    onSwipeRight: () => {
      const i = phaseSequence.indexOf(selected);
      const prev = i > 0 ? phaseSequence[i - 1] : undefined;
      if (prev !== undefined) selectPhase(prev);
      else tabPaging.goPrevTab();
    },
  });

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    activityProfileRepository.getByTripId(trip.id).then((p) => {
      if (!cancelled) setProfiles(p);
    });
    groupSplitRepository.listEvents(trip.id).then((records) => {
      if (!cancelled) setGroupCount(records.length);
    });
    return () => {
      cancelled = true;
    };
  }, [trip]);

  // Per-category plan preview for the selected phase (DEC-093 math, reused).
  useEffect(() => {
    if (!trip || !primaryPool || selected === 'all') {
      setPlanProgress(null);
      return;
    }
    const phaseId = selected;
    let cancelled = false;
    const load = async () => {
      const [plan, settings] = await Promise.all([
        // DEC-462: pool-preferred with a per-phase fallback, so a drifted pool
        // key can never hide the phase's plan again.
        scenarioPlanRepository.getActiveForPhase(trip.id, phaseId, primaryPool.id),
        phaseProfileSettingRepository.getByPhaseId(phaseId),
      ]);
      const allocations = plan ? await scenarioAllocationItemRepository.getByPlanId(plan.id) : [];
      if (cancelled) return;
      const enabled = profiles.filter((p) => isProfileEnabledInPhase(settings, phaseId, p.id));
      // DEC-477: one ruler — the card reads the SAME windowed/scoped progress
      // as Home and Planner. This fixes Julio's "Restaurante 106 sem plano"
      // (out-of-plan spend now labeled) and the stale "45 de bar" after edits
      // (the Planner flushes on exit; this recomputes on transactions/plan).
      setPlanProgress(
        calculatePlanProgress(
          enabled,
          allocations,
          transactions,
          phaseId,
          plan?.countFromIso ?? null,
        ),
      );
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [trip, primaryPool, selected, profiles, transactions]);

  if (!trip) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }
  const currency = trip.baseCurrency;
  // D14: the trip total is the sum of the trechos; pots are summed apart.
  const tripTotals = computeTripBudgetTotals(pools);

  // DEC-133 / DEC-288: local PNG export through the OS share sheet (no in-app
  // social). Migrated verbatim from the retired TripOverviewPage.
  const handleShareCard = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const stats = buildShareCardStats({
        transactions,
        pools,
        dayNumber: getDayNumber(trip.startDate),
        totalDays: getTotalDays(trip.startDate, trip.endDate),
      });
      const blob = await renderShareCard({
        tripName: trip.name,
        spentDisplay: formatMoney(stats.totalSpentCents, currency),
        subtitle: t('share.of_budget', {
          budget: formatMoney(stats.totalBudgetCents, currency),
          percent: stats.percentUsed,
        }),
        dayLine: t('share.day_of', { n: stats.dayNumber, total: stats.totalDays }),
        topCategoryLine: stats.topCategory
          ? t('share.top_category', {
              name: t(`categories.${stats.topCategory.category}` as never),
              amount: formatMoney(stats.topCategory.totalCents, currency),
            })
          : null,
        percentUsed: stats.percentUsed,
        dayPercent: stats.dayPercent,
      });
      if (!blob) {
        showToast(t('share.failed_toast'), 'danger');
        return;
      }
      // C05 · DEC-303: same universal feedback as every other share surface.
      const toast = shareOutcomeToast(await deliverShareCard(blob, 'trippilot-resumo.png'));
      if (toast) showToast(t(toast.messageKey), toast.tone);
    } finally {
      setSharing(false);
    }
  };

  const openRemanejar = (phaseId: string, overflowCents: number) => {
    const pool = selectActivePhasePool(pools, links, phaseId);
    if (pool) setRemanejarTarget({ pool, suggestedCents: overflowCents });
  };

  // Closing the planning door also drops the ?plan deep-link param so a reload
  // (or a back-and-forth) does not silently reopen the sheet.
  const closePlanExpense = () => {
    setPlanExpenseOpen(false);
    if (searchParams.get('plan')) {
      searchParams.delete('plan');
      setSearchParams(searchParams, { replace: true });
    }
  };

  // GATE 1 (DEC canonical model): each phase shows the free-to-spend of ITS OWN
  // budget. For a legacy trip (one shared pool) this resolves to that same pool
  // for every phase, so the numbers are unchanged; with one dedicated pool per
  // phase, each card now reflects the right budget instead of always the first.
  const freeForPhase = (phaseId: string): number => {
    const pool = selectActivePhasePool(pools, links, phaseId);
    if (!pool) return 0;
    return calculateFreeToSpend(
      pool,
      envelopes.filter((e) => e.budgetPoolId === pool.id),
      filterTransactionsByPool(transactions, pool.id),
      links.filter((l) => l.budgetPoolId === pool.id),
      phaseId,
      occurrences,
      plannedPurchases,
    ).freeToSpendCents;
  };

  const selectedPhase = selected !== 'all' ? phases.find((p) => p.id === selected) ?? null : null;

  // GATE 3 (D9): pots ("dinheiro à parte") get a dedicated "Potes e planejados"
  // home (below), so they are no longer mixed into the raw trecho-funds list.
  const pots = pools.filter((p) => p.scope === 'global' && p.deletedAt === null);

  // Funds in context: trecho funds only (pots have their own section now).
  // A specific phase → its linked fund; "all" → every trecho fund.
  const contextPools =
    selected === 'all'
      ? pools.filter((pool) => pool.scope === 'linked_phases')
      : pools.filter(
          (pool) =>
            pool.scope === 'linked_phases' &&
            links.some((l) => l.budgetPoolId === pool.id && l.phaseId === selected),
        );

  const openPlanned = plannedPurchases.filter(isPlannedPurchaseOpen);

  // GATE 4 (D9): every open Event lives in this section too (the Home only shows
  // the relevant ones via D8). An event linked to a session / confirmed has moved
  // on to the live outing, so it drops out here. Chronological by start date.
  const openEvents = occurrences
    .filter(
      (o) =>
        o.kind === 'event' &&
        o.deletedAt === null &&
        !o.isConfirmed &&
        o.linkedSessionId === null,
    )
    .sort((a, b) => (a.plannedDate ?? '').localeCompare(b.plannedDate ?? ''));

  // F3: the "Potes e planejados" section renders below the phase pane and used to
  // list EVERYTHING regardless of the chosen phase — so a pot/event/purchase
  // dated for another trecho showed up while viewing an earlier one. When a
  // specific phase is selected, scope each kind to it; the cross-phase "Todas"
  // view still shows all (D9). Events + purchases carry a `phaseId` (a trip-wide
  // purchase has none → always shown); pots are scoped by their owner trecho (a
  // dateless, ambient pot belongs to every phase view).
  const potsInScope = selectedPhase ? pots.filter((pot) => isPotInPhase(pot, selectedPhase)) : pots;
  const eventsInScope = selectedPhase
    ? openEvents.filter((event) => event.phaseId === selectedPhase.id)
    : openEvents;
  const plannedInScope = selectedPhase
    ? openPlanned.filter((purchase) => purchase.phaseId === selectedPhase.id || purchase.phaseId === null)
    : openPlanned;

  // DEC-477: rows come straight from the shared plan-progress lines — same
  // window (countFrom) and scope as the Planner and the Home metas.
  const categoryRows = (planProgress?.lines ?? [])
    .map((line) => {
      const profile = profiles.find((p) => p.id === line.profileId);
      return {
        id: line.profileId,
        name: line.profileName,
        icon: profile?.iconName ?? getCategoryIcon(line.category),
        plannedCents: line.plannedCents,
        spentCents: line.spentCents,
        done: line.done,
        remaining: line.remaining,
        outOfPlan: line.outOfPlan,
      };
    })
    .filter((row) => row.plannedCents > 0 || row.spentCents > 0)
    .sort((a, b) => b.plannedCents - a.plannedCents);

  // DEC-477: "livre após o plano" — the phase free minus what the plan still
  // holds (same trueFree formula as the Home hero).
  const freeAfterPlanCents =
    selectedPhase && planProgress
      ? freeForPhase(selectedPhase.id) - planProgress.reserveCents
      : null;

  const structureItems: StructureItem[] = [
    { icon: 'timeline', label: t('more.edit_phases'), path: '/trip/edit' },
    { icon: 'category', label: t('more.profiles'), path: '/profiles' },
    // DEC-360 (G9): "Participantes" (→ /shared) is renamed to "Acerto de contas"
    // (what the screen actually does), and group divisions get their OWN first-
    // level tile → /groups (the single canonical list), with an active count.
    { icon: 'account_balance_wallet', label: t('more.settle'), path: '/shared' },
    { icon: 'groups', label: t('more.group_divisions'), path: '/groups', badge: groupCount },
    { icon: 'credit_card', label: t('more.wallets'), path: '/wallets' },
    { icon: 'history', label: t('more.outing_history'), path: '/expenses?tab=outings' },
    // DEC-460: the trip diary — memories view over the same data.
    { icon: 'auto_stories', label: t('more.diary'), path: '/diary' },
  ];

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2" data-inpage-swipe {...phaseSwipe}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-heading font-bold text-on-surface">{t('trip_hub.title')}</h1>
          <p className="text-sm text-on-surface-dim mt-0.5">{t('trip_hub.subtitle')}</p>
        </div>
        {/* DEC-288: shareable summary card, migrated from the retired overview. */}
        <button
          onClick={handleShareCard}
          disabled={sharing}
          className="btn-press w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-50 shrink-0"
          style={{ background: 'var(--highlight-subtle)' }}
          aria-label={t('share.button')}
        >
          <Icon name="ios_share" size={18} className="text-primary" />
        </button>
      </div>

      {/* Phase selector — the single source of context for this page */}
      {sortedPhases.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <SelectorChip
            label={t('trip_hub.all_phases')}
            active={selected === 'all'}
            onClick={() => selectPhase('all')}
          />
          {sortedPhases.map((phase) => (
            <SelectorChip
              key={phase.id}
              label={phase.name}
              active={selected === phase.id}
              onClick={() => selectPhase(phase.id)}
            />
          ))}
        </div>
      )}

      {/* DEC-197 (N3): keyed pane — slides in from the side matching the
          swipe/tap direction whenever the selected phase changes. */}
      <div key={String(selected)} className={phaseDirRef.current === 'next' ? 'pane-next' : 'pane-prev'}>
      {selected === 'all' ? (
        <>
          {/* Trip summary */}
          <div className="bg-surface-container rounded-2xl p-5">
            <p className="text-xs font-bold text-primary uppercase tracking-wider">{trip.name}</p>
            <p className="text-sm text-on-surface-dim mt-2">
              {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
            </p>
            <div className="mt-4 pt-4 border-t border-on-surface-mute">
              <div className="flex justify-between">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-faint uppercase">
                    {t('trip_hub.trip_total')}
                  </p>
                  <p className="text-xl font-extrabold tabular text-on-surface mt-1">
                    {formatMoney(tripTotals.trechosTotalCents, currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-on-surface-faint uppercase">
                    {t('trip.total_spent')}
                  </p>
                  <p className="text-xl font-extrabold tabular text-primary mt-1">
                    {formatMoney(calculateTotalSpent(transactions), currency)}
                  </p>
                </div>
              </div>
              {tripTotals.potesTotalCents > 0 && (
                <p className="text-[11px] text-on-surface-faint mt-2">
                  {t('trip_hub.pots_apart', {
                    amount: formatMoney(tripTotals.potesTotalCents, currency),
                  })}
                </p>
              )}
              <p className="text-[10px] text-on-surface-faint mt-1">{t('trip_hub.trip_total_hint')}</p>
            </div>
          </div>

          {/* Cross-phase cards — tap to drill into a phase (no extra screen) */}
          <div>
            <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
              {t('trip_hub.phases_title')}
            </p>
            <div className="flex flex-col gap-2">
              {sortedPhases.map((phase) => {
                const spent = filterTransactionsByPhase(transactions, phase.id)
                  .filter((tx) => tx.type === 'expense')
                  .reduce((sum, tx) => sum + tx.amountCents, 0);
                const free = freeForPhase(phase.id);
                const balance = summarizeTrechoBalance(free);
                const isCurrent = phase.id === activePhaseId;
                return (
                  <div key={phase.id} className="flex flex-col">
                    <button
                      onClick={() => selectPhase(phase.id)}
                      className="bg-surface-container rounded-xl p-4 w-full text-left btn-press"
                      style={isCurrent ? { border: '1px solid #C75B3925' } : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{phase.name}</p>
                          <p className="text-xs text-on-surface-faint mt-0.5">
                            {formatDate(phase.startDate)} — {formatDate(phase.endDate)}
                          </p>
                        </div>
                        {isCurrent && (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-primary/15 text-primary shrink-0">
                            {t('trip.phase_active')}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-baseline mt-3">
                        <p className="text-xs font-semibold text-on-surface-dim">
                          {t('trip_hub.phase_spent_short')}: {formatMoney(spent, currency)}
                        </p>
                        {balance.status === 'over' ? (
                          <p className="text-xs font-bold tabular text-error">
                            {t('trip_hub.phase_over_short', {
                              amount: formatMoney(balance.overflowCents, currency),
                            })}
                          </p>
                        ) : (
                          <p className="text-xs font-bold tabular text-success">
                            {t('trip_hub.phase_free_short')}: {formatMoney(free, currency)}
                          </p>
                        )}
                      </div>
                    </button>
                    {balance.status === 'over' && (
                      <button
                        onClick={() => openRemanejar(phase.id, balance.overflowCents)}
                        className="mt-1 self-end flex items-center gap-1 px-3 py-1.5 rounded-lg btn-press bg-error/10 text-error"
                      >
                        <Icon name="swap_horiz" size={14} className="text-error" />
                        <span className="text-[11px] font-bold">{t('trecho.remanejar_cta')}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setAddTrechoOpen(true)}
              className="mt-2 w-full py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
              style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
            >
              <Icon name="add" size={18} className="text-primary" />
              {t('trecho.add_cta')}
            </button>
          </div>
        </>
      ) : (
        selectedPhase && (
          <>
            {/* Planning preview (inline, not just a link) */}
            <button
              onClick={() => navigate('/planner')}
              className="bg-surface-container rounded-2xl p-5 w-full text-left btn-press"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint">
                    {t('trip_hub.planning_preview')}
                  </p>
                  <p className="text-sm font-bold text-on-surface mt-1">{selectedPhase.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-on-surface-faint uppercase">
                    {t('trip_hub.phase_free')}
                  </p>
                  <p className="text-xl font-extrabold tabular text-success mt-0.5">
                    {formatMoney(freeForPhase(selectedPhase.id), currency)}
                  </p>
                </div>
              </div>

              {categoryRows.length > 0 ? (
                <div className="mt-4 pt-4 border-t border-on-surface-mute flex flex-col gap-2.5">
                  {categoryRows.slice(0, 4).map((row) => (
                    <div key={row.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-surface-high">
                        <Icon name={row.icon} size={15} className="text-on-surface-dim" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-on-surface truncate">{row.name}</p>
                        {/* DEC-477: say WHY a number shows — "1 feita · 2
                            restantes" for planned rows, an explicit tag for
                            spend with no plan (Julio's €106 restaurant). */}
                        {row.plannedCents > 0 ? (
                          <p className="text-[10px] font-semibold text-on-surface-faint tabular">
                            {t('trip_hub.category_progress', {
                              done: row.done,
                              remaining: row.remaining,
                            })}
                          </p>
                        ) : (
                          <p className="text-[10px] font-semibold text-on-surface-faint">
                            {t('trip_hub.out_of_plan')}
                          </p>
                        )}
                      </div>
                      <p
                        className={`text-sm font-bold tabular ${
                          row.plannedCents > 0 && row.spentCents > row.plannedCents
                            ? 'text-warning'
                            : 'text-on-surface'
                        }`}
                      >
                        {formatMoney(row.spentCents, currency)}
                      </p>
                      {row.plannedCents > 0 && (
                        <p className="text-[11px] font-semibold tabular text-on-surface-faint">
                          {t('trip_hub.category_of_budget', {
                            budget: formatMoney(row.plannedCents, currency),
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                  {/* DEC-477: close the loop the Home opens — "free in phase −
                      still reserved = free after the plan" (same trueFree). */}
                  {freeAfterPlanCents !== null && (planProgress?.reserveCents ?? 0) > 0 && (
                    <p className="text-[11px] font-semibold text-on-surface-dim tabular pt-1">
                      {t('trip_hub.free_after_plan', {
                        amount: formatMoney(Math.max(0, freeAfterPlanCents), currency),
                        reserved: formatMoney(planProgress!.reserveCents, currency),
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-on-surface-faint mt-4 pt-4 border-t border-on-surface-mute">
                  {t('trip_hub.planning_empty')}
                </p>
              )}

              <div className="mt-4 flex items-center gap-1 text-primary">
                <Icon name="tune" size={15} className="text-primary" />
                <span className="text-xs font-bold">{t('trip_hub.edit_plan')}</span>
              </div>
            </button>
            {/* D-IMP-02: surface the phase's future-vision preview right here on
                the Viagem tab (it was only reachable via Home → overview). Same
                route, just a more discoverable door (sibling, not nested). */}
            <button
              onClick={() => navigate(`/phase-preview/${selectedPhase.id}`)}
              className="mt-2 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 btn-press bg-surface-container"
            >
              <Icon name="calendar_month" size={16} className="text-primary" />
              <span className="text-xs font-bold text-primary">{t('trip.phase_preview_cta')}</span>
            </button>
          </>
        )
      )}
      </div>

      {/* Potes e planejados (GATE 3 M3.4 / master §6): pots ("dinheiro à parte")
          get their canonical home here, right below the trechos; planned
          purchases share the section. The Home only surfaces the relevant ones
          (D8) — this list always shows everything (D9). */}
      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('trip_hub.pots_section_title')}
        </p>
        {potsInScope.length === 0 && plannedInScope.length === 0 && eventsInScope.length === 0 ? (
          <p className="text-sm text-on-surface-dim px-1">{t('trip_hub.pots_empty')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {eventsInScope.map((event) => {
              // reservedCents set = the event eats from its trecho (do trecho);
              // null = its money is à parte (a Pote). Show the right amount + tag.
              const fundedByPhase = event.reservedCents !== null;
              const amountCents = event.reservedCents ?? event.estimatedCostCents;
              const hasRange = event.endDate && event.endDate !== event.plannedDate;
              return (
                <button
                  key={event.id}
                  onClick={() => navigate(`/trip/edit?occurrence=${event.id}`)}
                  className="bg-surface-container rounded-xl p-4 w-full text-left btn-press"
                >
                  <div className="flex justify-between items-baseline gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name="celebration" size={16} className="text-primary shrink-0" />
                      <p className="text-sm font-bold text-on-surface truncate">{event.name}</p>
                    </div>
                    <p className="text-sm font-extrabold tabular shrink-0 text-on-surface">
                      {formatMoney(amountCents, currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-on-surface-faint">
                    {event.plannedDate && (
                      <span className="flex items-center gap-1">
                        <Icon name="event" size={12} className="text-on-surface-faint" />
                        {formatDate(event.plannedDate)}
                        {hasRange ? ` – ${formatDate(event.endDate!)}` : ''}
                      </span>
                    )}
                    <span
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                      style={{
                        background: fundedByPhase ? 'var(--surface-high)' : '#C75B3918',
                        color: fundedByPhase ? 'var(--on-surface-dim)' : 'var(--primary)',
                      }}
                    >
                      {fundedByPhase ? t('trip_hub.event_from_trecho') : t('trip_hub.event_apart')}
                    </span>
                  </div>
                </button>
              );
            })}
            {potsInScope.map((pot) => {
              const summary = createPoolSummary(pot, filterTransactionsByPool(transactions, pot.id));
              const goalCents = pot.goalCents ?? null;
              const goalPct =
                goalCents && goalCents > 0
                  ? Math.min(100, Math.max(0, Math.round((summary.totalCents / goalCents) * 100)))
                  : null;
              const hasRange = pot.dateEnd && pot.dateEnd !== pot.dateStart;
              return (
                <button
                  key={pot.id}
                  onClick={() => navigate('/funds')}
                  className="bg-surface-container rounded-xl p-4 w-full text-left btn-press"
                >
                  <div className="flex justify-between items-baseline gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name="savings" size={16} className="text-primary shrink-0" />
                      <p className="text-sm font-bold text-on-surface truncate">{pot.name}</p>
                    </div>
                    <p className="text-sm font-extrabold tabular shrink-0 text-success">
                      {formatMoney(summary.remainingCents, pot.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-on-surface-faint">
                    <span className="tabular">
                      {formatMoney(summary.spentCents, pot.currency)} /{' '}
                      {formatMoney(summary.totalCents, pot.currency)}
                    </span>
                    {pot.dateStart && (
                      <span className="flex items-center gap-1">
                        <Icon name="event" size={12} className="text-on-surface-faint" />
                        {formatDate(pot.dateStart)}
                        {hasRange ? ` – ${formatDate(pot.dateEnd!)}` : ''}
                      </span>
                    )}
                  </div>
                  {goalPct !== null && (
                    <div className="mt-2">
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'var(--surface-container-high)' }}
                      >
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${goalPct}%`, background: 'var(--primary)' }}
                        />
                      </div>
                      <p className="text-[10px] text-on-surface-faint mt-1">
                        {t('trip_hub.pot_goal_progress', {
                          saved: formatMoney(summary.totalCents, pot.currency),
                          goal: formatMoney(goalCents!, pot.currency),
                        })}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
            {plannedInScope.slice(0, 4).map((purchase) => {
              const remaining =
                purchase.reservedCents !== null
                  ? plannedPurchaseReservedRemainingCents(purchase, transactions)
                  : null;
              return (
                <button
                  key={purchase.id}
                  onClick={() => navigate('/planned')}
                  className="bg-surface-container rounded-xl px-4 py-3 w-full flex items-center gap-3 btn-press text-left"
                >
                  <Icon
                    name={getCategoryIcon(purchase.category)}
                    size={18}
                    className="text-on-surface-dim shrink-0"
                  />
                  <p className="text-sm text-on-surface flex-1 truncate">{purchase.name}</p>
                  {remaining !== null && (
                    <p className="text-xs font-semibold tabular text-on-surface-dim">
                      {t('trip_hub.planned_reserved', { amount: formatMoney(remaining, currency) })}
                    </p>
                  )}
                  <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-on-surface-faint mt-2 px-1 leading-relaxed">
          {t('trip_hub.pots_what_is')}
        </p>
        <button
          onClick={() => setPlanExpenseOpen(true)}
          className="mt-2 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 btn-press"
          style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
        >
          <Icon name="edit_calendar" size={16} className="text-primary" />
          <span className="text-xs font-bold">{t('trip_hub.plan_cta')}</span>
        </button>
      </div>

      {/* Funds (context-aware) */}
      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('trip_hub.funds_title')}
        </p>
        {contextPools.length === 0 ? (
          <p className="text-sm text-on-surface-dim px-1">{t('trip_hub.no_funds')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {contextPools.map((pool) => {
              const summary = createPoolSummary(pool, filterTransactionsByPool(transactions, pool.id));
              const over = summary.remainingCents < 0;
              const pct = Math.min(100, Math.max(0, summary.percentUsed));
              const barColor = over
                ? 'var(--error)'
                : summary.percentUsed >= 85
                  ? 'var(--warning)'
                  : 'var(--success)';
              return (
                <button
                  key={pool.id}
                  onClick={() => navigate('/funds')}
                  className="bg-surface-container rounded-xl p-4 w-full text-left btn-press"
                >
                  <div className="flex justify-between items-baseline gap-3">
                    <p className="text-sm font-bold text-on-surface truncate">{pool.name}</p>
                    <p
                      className="text-sm font-extrabold tabular shrink-0"
                      style={{ color: over ? 'var(--error)' : 'var(--success)' }}
                    >
                      {formatMoney(summary.remainingCents, pool.currency)}
                    </p>
                  </div>
                  <p className="text-xs text-on-surface-faint mt-0.5">
                    {formatMoney(summary.spentCents, pool.currency)} /{' '}
                    {formatMoney(summary.totalCents, pool.currency)}
                  </p>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden mt-2"
                    style={{ background: 'var(--surface-container-high)' }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-on-surface-faint mt-2 px-1 leading-relaxed">
          {t('trip_hub.fund_what_is')}
        </p>
        <button
          onClick={() => navigate('/funds')}
          className="mt-2 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 btn-press"
          style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
        >
          <Icon name="account_balance_wallet" size={16} className="text-primary" />
          <span className="text-xs font-bold">{t('trip_hub.manage_funds')}</span>
        </button>
      </div>

      {/* Structure — every destination keeps a tile (nothing lost). U2: a grid
          of tiles instead of a list (Julio: "podia ser um grid com 6 opções"). */}
      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('trip_hub.section_structure')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {structureItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="bg-surface-container rounded-xl p-3 btn-press flex flex-col items-center text-center gap-2 h-full"
            >
              <div className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-surface-high">
                <Icon name={item.icon} size={20} className="text-on-surface-dim" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-surface text-[10px] font-bold flex items-center justify-center tabular">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-on-surface leading-tight line-clamp-2">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AddTrechoSheet
        open={addTrechoOpen}
        onClose={() => setAddTrechoOpen(false)}
        trip={trip}
        phases={phases}
        onCreated={reload}
      />
      <PlanExpenseSheet
        open={planExpenseOpen}
        onClose={closePlanExpense}
        trip={trip}
        phases={phases}
        pools={pools}
        links={links}
        onCreated={reload}
      />
      <RemanejarSheet
        open={remanejarTarget !== null}
        onClose={() => setRemanejarTarget(null)}
        trip={trip}
        targetPool={remanejarTarget?.pool ?? null}
        pools={pools}
        suggestedCents={remanejarTarget?.suggestedCents ?? 0}
        onDone={reload}
      />
    </div>
  );
}

function SelectorChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold btn-press whitespace-nowrap ${
        active ? 'bg-primary text-on-surface' : 'bg-surface-container text-on-surface-dim'
      }`}
    >
      {label}
    </button>
  );
}
