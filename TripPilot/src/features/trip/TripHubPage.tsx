import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { sortPhasesByOrder, findActivePhase, formatDate } from '@/domain/dates';
import {
  calculateTotalBudget,
  calculateTotalSpent,
  calculateFreeToSpend,
  createPoolSummary,
} from '@/domain/budget';
import { filterTransactionsByPhase, filterTransactionsByPool } from '@/domain/transactions';
import { calculateOccasionForecasts, type OccasionForecast } from '@/domain/forecasting';
import { isProfileEnabledInPhase } from '@/domain/profiles';
import { formatMoney, sumCents } from '@/domain/money';
import {
  isPlannedPurchaseOpen,
  plannedPurchaseReservedRemainingCents,
} from '@/domain/planning/planned-purchases';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
} from '@/data/repositories';
import type { ActivityProfile } from '@/domain/types/activity-profile';

type Selection = string | 'all';

interface StructureItem {
  icon: string;
  label: string;
  path: string;
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
  const { trip, phases, pools, links, envelopes, transactions, occurrences, plannedPurchases } =
    useAppData();

  const [selectedPhaseId, setSelectedPhaseId] = useState<Selection | null>(null);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [forecasts, setForecasts] = useState<OccasionForecast[]>([]);

  const sortedPhases = useMemo(() => sortPhasesByOrder(phases), [phases]);
  const activePhaseId = useMemo(() => findActivePhase(phases)?.id ?? null, [phases]);
  // Default to the current phase (most actionable); fall back to "all". Using a
  // derived value (not an effect) keeps it correct even if phases load late.
  const selected: Selection = selectedPhaseId ?? activePhaseId ?? 'all';
  const primaryPool = pools.find((p) => p.scope === 'linked_phases');

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    activityProfileRepository.getByTripId(trip.id).then((p) => {
      if (!cancelled) setProfiles(p);
    });
    return () => {
      cancelled = true;
    };
  }, [trip]);

  // Per-category plan preview for the selected phase (DEC-093 math, reused).
  useEffect(() => {
    if (!trip || !primaryPool || selected === 'all') {
      setForecasts([]);
      return;
    }
    const phaseId = selected;
    let cancelled = false;
    const load = async () => {
      const [plan, settings] = await Promise.all([
        scenarioPlanRepository.getActiveByPhaseAndPool(trip.id, phaseId, primaryPool.id),
        phaseProfileSettingRepository.getByPhaseId(phaseId),
      ]);
      const allocations = plan ? await scenarioAllocationItemRepository.getByPlanId(plan.id) : [];
      if (cancelled) return;
      const enabled = profiles.filter((p) => isProfileEnabledInPhase(settings, phaseId, p.id));
      setForecasts(calculateOccasionForecasts(enabled, allocations, transactions, phaseId));
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

  const freeForPhase = (phaseId: string): number => {
    if (!primaryPool) return 0;
    return calculateFreeToSpend(
      primaryPool,
      envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
      filterTransactionsByPool(transactions, primaryPool.id),
      links.filter((l) => l.budgetPoolId === primaryPool.id),
      phaseId,
      occurrences,
      plannedPurchases,
    ).freeToSpendCents;
  };

  const selectedPhase = selected !== 'all' ? phases.find((p) => p.id === selected) ?? null : null;

  // Funds in context: a specific phase → pools linked to it + global pools;
  // "all" → every pool.
  const contextPools =
    selected === 'all'
      ? pools
      : pools.filter(
          (pool) =>
            pool.scope === 'global' ||
            links.some((l) => l.budgetPoolId === pool.id && l.phaseId === selected),
        );

  const openPlanned = plannedPurchases.filter(isPlannedPurchaseOpen);

  const categoryRows = forecasts
    .map((forecast) => {
      const profile = profiles.find((p) => p.id === forecast.profileId);
      const typical = profile?.typicalValueCents ?? 0;
      const spentCents = sumCents(
        (selectedPhase ? filterTransactionsByPhase(transactions, selectedPhase.id) : [])
          .filter((tx) => tx.activityProfileId === forecast.profileId && tx.type === 'expense')
          .map((tx) => tx.personalCostCents ?? tx.amountCents),
      );
      return {
        id: forecast.profileId,
        name: forecast.profileName,
        icon: profile?.iconName ?? getCategoryIcon(profile?.category ?? 'other'),
        plannedCents: forecast.totalPlanned * typical,
        spentCents,
      };
    })
    .filter((row) => row.plannedCents > 0 || row.spentCents > 0)
    .sort((a, b) => b.plannedCents - a.plannedCents);

  const structureItems: StructureItem[] = [
    { icon: 'map', label: t('trip_hub.overview_card'), path: '/trip' },
    { icon: 'timeline', label: t('more.edit_phases'), path: '/trip/edit' },
    { icon: 'category', label: t('more.profiles'), path: '/profiles' },
    { icon: 'groups', label: t('more.participants'), path: '/shared' },
    { icon: 'credit_card', label: t('more.wallets'), path: '/wallets' },
    { icon: 'history', label: t('more.outing_history'), path: '/expenses?tab=outings' },
  ];

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <div>
        <h1 className="text-heading font-bold text-on-surface">{t('trip_hub.title')}</h1>
        <p className="text-sm text-on-surface-dim mt-0.5">{t('trip_hub.subtitle')}</p>
      </div>

      {/* Phase selector — the single source of context for this page */}
      {sortedPhases.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
          <SelectorChip
            label={t('trip_hub.all_phases')}
            active={selected === 'all'}
            onClick={() => setSelectedPhaseId('all')}
          />
          {sortedPhases.map((phase) => (
            <SelectorChip
              key={phase.id}
              label={phase.name}
              active={selected === phase.id}
              onClick={() => setSelectedPhaseId(phase.id)}
            />
          ))}
        </div>
      )}

      {selected === 'all' ? (
        <>
          {/* Trip summary */}
          <div className="bg-surface-container rounded-2xl p-5">
            <p className="text-xs font-bold text-primary uppercase tracking-wider">{trip.name}</p>
            <p className="text-sm text-on-surface-dim mt-2">
              {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
            </p>
            <div className="flex justify-between mt-4 pt-4 border-t border-on-surface-mute">
              <div>
                <p className="text-[10px] font-bold text-on-surface-faint uppercase">
                  {t('trip.total_budget')}
                </p>
                <p className="text-xl font-extrabold tabular text-on-surface mt-1">
                  {formatMoney(calculateTotalBudget(pools), currency)}
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
                const isCurrent = phase.id === activePhaseId;
                return (
                  <button
                    key={phase.id}
                    onClick={() => setSelectedPhaseId(phase.id)}
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
                      <p className="text-xs font-bold tabular text-success">
                        {t('trip_hub.phase_free_short')}: {formatMoney(free, currency)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
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
                      <p className="text-sm text-on-surface flex-1 truncate">{row.name}</p>
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
          </>
        )
      )}

      {/* Planned purchases — trip-level planning */}
      {openPlanned.length > 0 && (
        <div>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            {t('trip_hub.planned_title')}
          </p>
          <div className="bg-surface-container rounded-xl overflow-hidden">
            {openPlanned.slice(0, 4).map((purchase, i) => {
              const remaining =
                purchase.reservedCents !== null
                  ? plannedPurchaseReservedRemainingCents(purchase, transactions)
                  : null;
              return (
                <button
                  key={purchase.id}
                  onClick={() => navigate('/planned')}
                  className={`w-full flex items-center gap-3 px-4 py-3 btn-press text-left ${
                    i < Math.min(openPlanned.length, 4) - 1 ? 'border-b border-on-surface-mute' : ''
                  }`}
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
        </div>
      )}

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

      {/* Structure — every destination keeps a tile (nothing lost) */}
      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('trip_hub.section_structure')}
        </p>
        <div className="bg-surface-container rounded-xl overflow-hidden">
          {structureItems.map((item, i) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 btn-press text-left ${
                i < structureItems.length - 1 ? 'border-b border-on-surface-mute' : ''
              }`}
            >
              <Icon name={item.icon} size={20} className="text-on-surface-dim shrink-0" />
              <span className="text-sm text-on-surface flex-1">{item.label}</span>
              <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
            </button>
          ))}
        </div>
      </div>
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
