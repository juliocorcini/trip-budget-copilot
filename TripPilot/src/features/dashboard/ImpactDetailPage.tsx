import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useScrolled } from '@/hooks/useScrolled';
import { resolveActivePhase, formatDate, localDateString, formatShortDate, localDayOf } from '@/domain/dates';
import { calculateFreeToSpend, calculatePoolSpent, projectReserveStartDate } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { calculateEffectiveSpendingDays } from '@/domain/phases';
import { calculateOccasionForecasts, type OccasionForecast } from '@/domain/forecasting';
import { isProfileEnabledInPhase } from '@/domain/profiles';
import { formatMoney, sumCents } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
} from '@/data/repositories';
import type { ActivityProfile } from '@/domain/types/activity-profile';

/**
 * DEC-093 (R-11): "Ver impacto completo" — planned vs spent per category,
 * the spend that triggered the card, end-of-phase projection and reserve
 * risk date. CTA goes to the Planner. This is NOT the simulator.
 */
export function ImpactDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const { trip, phases, pools, links, envelopes, transactions, occurrences, plannedPurchases, loading } =
    useAppData();

  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [forecasts, setForecasts] = useState<OccasionForecast[]>([]);

  const activePhase = resolveActivePhase(phases);
  const primaryPool = pools.find((p) => p.scope === 'linked_phases');

  useEffect(() => {
    if (!trip || !activePhase || !primaryPool) return;
    let cancelled = false;
    const load = async () => {
      const [profs, plan, settings] = await Promise.all([
        activityProfileRepository.getByTripId(trip.id),
        scenarioPlanRepository.getActiveByPhaseAndPool(trip.id, activePhase.id, primaryPool.id),
        phaseProfileSettingRepository.getByPhaseId(activePhase.id),
      ]);
      const allocations = plan
        ? await scenarioAllocationItemRepository.getByPlanId(plan.id)
        : [];
      if (cancelled) return;
      setProfiles(profs);
      const enabled = profs.filter((p) =>
        isProfileEnabledInPhase(settings, activePhase.id, p.id),
      );
      setForecasts(
        calculateOccasionForecasts(enabled, allocations, transactions, activePhase.id),
      );
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [trip, activePhase, primaryPool, transactions]);

  if (loading || !trip) return null;

  const todayIso = localDateString(new Date());
  const phaseTxs = activePhase
    ? transactions.filter((tx) => tx.phaseId === activePhase.id && tx.deletedAt === null)
    : [];
  const fts =
    primaryPool && activePhase
      ? calculateFreeToSpend(
          primaryPool,
          envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
          filterTransactionsByPool(transactions, primaryPool.id),
          links.filter((l) => l.budgetPoolId === primaryPool.id),
          activePhase.id,
          occurrences,
          plannedPurchases,
        )
      : null;

  const phaseSpentCents = calculatePoolSpent(phaseTxs);
  const phaseBudgetCents = fts ? fts.freeToSpendCents + phaseSpentCents : 0;

  // DEC-236: the spend that weighed MOST this phase — the real culprit. No
  // longer filtered to activity-profile expenses (a plain "Outros" can be the
  // biggest hit, and that is exactly what blew the budget). Sorted by personal
  // cost, descending.
  const biggestTx =
    [...phaseTxs]
      .filter((tx) => tx.type === 'expense')
      .sort(
        (a, b) => (b.personalCostCents ?? b.amountCents) - (a.personalCostCents ?? a.amountCents),
      )[0] ?? null;

  // End-of-phase projection (same math as the projection insight).
  let projectedCents = 0;
  let projectionAvailable = false;
  if (activePhase && phaseSpentCents > 0) {
    const totalEffective = calculateEffectiveSpendingDays(activePhase, activePhase.startDate);
    const remainingEffective = calculateEffectiveSpendingDays(
      activePhase,
      formatNextDay(todayIso),
    );
    const elapsedEffective = Math.max(0.1, totalEffective - remainingEffective);
    projectedCents = Math.round(
      phaseSpentCents + (phaseSpentCents / elapsedEffective) * remainingEffective,
    );
    projectionAvailable = true;
  }
  const projectionDiffCents = projectedCents - phaseBudgetCents;

  const reserveDate = activePhase
    ? projectReserveStartDate(activePhase, todayIso, phaseSpentCents, phaseBudgetCents)
    : null;

  const rows = forecasts.map((forecast) => {
    const profile = profiles.find((p) => p.id === forecast.profileId);
    const typical = profile?.typicalValueCents ?? 0;
    const spentCents = sumCents(
      phaseTxs
        .filter((tx) => tx.activityProfileId === forecast.profileId && tx.type === 'expense')
        .map((tx) => tx.personalCostCents ?? tx.amountCents),
    );
    return {
      forecast,
      icon: profile?.iconName ?? getCategoryIcon(profile?.category ?? 'other'),
      plannedBudgetCents: forecast.totalPlanned * typical,
      spentCents,
    };
  });

  // DEC-236: "broke" is the TRUE free (hero) ≤ 0 — pool free minus the plan
  // still reserved — same definition as the Honest Friend card, so the two
  // never disagree. The plan reserve is the unspent part of each allocation.
  const planReservedCents = rows.reduce(
    (sum, r) =>
      r.plannedBudgetCents > 0
        ? sum + (r.plannedBudgetCents - Math.min(r.spentCents, r.plannedBudgetCents))
        : sum,
    0,
  );
  const trueFreeRawCents = fts ? fts.freeToSpendRawCents - planReservedCents : 0;
  const phaseBroke = fts ? trueFreeRawCents <= 0 : false;
  const reserveUsedCents = fts ? Math.max(0, -fts.freeToSpendRawCents) : 0;
  const planShortfallCents = reserveUsedCents > 0 ? 0 : Math.max(0, -trueFreeRawCents);

  return (
    <div className="flex flex-col pb-6">
      <div
        className={`page-sticky-header ${scrolled ? 'is-scrolled' : ''} pt-4 pb-3 flex items-center gap-3`}
      >
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">
          {t('impact.title')}
        </h1>
      </div>

      {/* DEC-236: when the phase is broke, lead with that — never bury it under
          a per-category table. */}
      {phaseBroke && (
        <div
          className="mt-3 p-4 rounded-2xl flex items-start gap-3"
          style={{ background: '#D9404012', border: '1px solid #D9404026' }}
        >
          <Icon name="priority_high" size={20} className="text-error mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-error">{t('impact.phase_broke_title')}</p>
            <p className="text-xs font-semibold text-on-surface-dim mt-0.5 leading-snug">
              {reserveUsedCents > 0
                ? t('impact.phase_broke_reserve', {
                    amount: formatMoney(reserveUsedCents, trip.baseCurrency),
                  })
                : planShortfallCents > 0
                  ? t('impact.phase_broke_plan', {
                      amount: formatMoney(planShortfallCents, trip.baseCurrency),
                    })
                  : t('impact.phase_broke_edge')}
            </p>
          </div>
        </div>
      )}

      {/* DEC-236: the biggest spend of the phase — the real culprit. */}
      {biggestTx && (
        <div className="mt-3 p-4 rounded-2xl bg-surface-container">
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
            {t('impact.biggest')}
          </p>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-sm font-bold text-on-surface">{biggestTx.description}</p>
              <p className="text-xs text-on-surface-faint mt-0.5">
                {formatShortDate(localDayOf(biggestTx.date))}
              </p>
            </div>
            <p className="text-base font-extrabold tabular text-on-surface">
              {formatMoney(biggestTx.personalCostCents ?? biggestTx.amountCents, trip.baseCurrency)}
            </p>
          </div>
        </div>
      )}

      {/* Planned vs spent per category */}
      <div className="mt-3 p-4 rounded-2xl bg-surface-container">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint mb-2">
          {t('impact.planned_vs_actual')}
        </p>
        {rows.length === 0 && (
          <p className="text-sm text-on-surface-dim py-2">{t('impact.no_plan_data')}</p>
        )}
        {rows.map(({ forecast, icon, plannedBudgetCents, spentCents }) => (
          <div
            key={forecast.profileId}
            className="py-2.5 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--border-hairline)' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-surface-high">
              <Icon name={icon} size={16} className="text-on-surface-dim" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface truncate">{forecast.profileName}</p>
              <p className="text-[11px] font-semibold text-on-surface-faint">
                {t('impact.occasions_done', {
                  done: forecast.spent,
                  planned: forecast.totalPlanned,
                })}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-bold tabular ${
                  plannedBudgetCents > 0 && spentCents > plannedBudgetCents
                    ? 'text-warning'
                    : 'text-on-surface'
                }`}
              >
                {formatMoney(spentCents, trip.baseCurrency)}
              </p>
              {plannedBudgetCents > 0 && (
                <p className="text-[11px] font-semibold tabular text-on-surface-faint">
                  {t('impact.of_budget', {
                    budget: formatMoney(plannedBudgetCents, trip.baseCurrency),
                  })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* End-of-phase projection */}
      {projectionAvailable && (
        <div className="mt-3 p-4 rounded-2xl bg-surface-container">
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint mb-2">
            {t('impact.projection')}
          </p>
          <div className="flex justify-between py-1.5">
            <span className="text-xs font-semibold text-on-surface-dim">
              {t('dashboard.detail_projected_total')}
            </span>
            <span className="text-sm font-bold tabular text-on-surface">
              {formatMoney(projectedCents, trip.baseCurrency)}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-xs font-semibold text-on-surface-dim">
              {t('dashboard.detail_phase_budget')}
            </span>
            <span className="text-sm font-bold tabular text-on-surface">
              {formatMoney(phaseBudgetCents, trip.baseCurrency)}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-xs font-semibold text-on-surface-dim">
              {t(projectionDiffCents > 0 ? 'dashboard.detail_over_by' : 'dashboard.detail_under_by')}
            </span>
            <span
              className={`text-sm font-bold tabular ${
                projectionDiffCents > 0 ? 'text-warning' : 'text-success'
              }`}
            >
              {formatMoney(Math.abs(projectionDiffCents), trip.baseCurrency)}
            </span>
          </div>
        </div>
      )}

      {/* Reserve risk */}
      <div
        className="mt-3 p-4 rounded-2xl flex items-center gap-3"
        style={
          reserveDate
            ? { background: '#D4A84312', border: '1px solid #D4A84320' }
            : { background: '#6B8F7112', border: '1px solid #6B8F7118' }
        }
      >
        <Icon
          name={reserveDate ? 'warning' : 'verified_user'}
          size={20}
          className={reserveDate ? 'text-warning' : 'text-success'}
        />
        <p className={`text-sm font-semibold ${reserveDate ? 'text-warning' : 'text-success'}`}>
          {reserveDate
            ? reserveDate <= todayIso
              ? t('impact.reserve_in_use_now')
              : t('impact.reserve_risk_date', { date: formatDate(reserveDate, "d 'de' MMMM") })
            : t('impact.reserve_safe')}
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate('/planner')}
        className="mt-4 py-3.5 rounded-xl font-bold text-sm btn-press"
        style={{ background: 'var(--primary)', color: 'var(--surface)' }}
      >
        {t('impact.adjust_plan')}
      </button>
    </div>
  );
}

function formatNextDay(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
