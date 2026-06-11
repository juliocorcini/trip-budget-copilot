import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase, localDateString } from '@/domain/dates';
import { calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool, calculateSpentOnDate } from '@/domain/transactions';
import { calculateTodayFreeBudget } from '@/domain/phases';
import {
  simulateSpendMultiMetric,
  calculateOccasionForecasts,
  type SimulatorVerdict,
} from '@/domain/forecasting';
import { isProfileEnabledInPhase } from '@/domain/profiles';
import { toCents, fromCents, formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import { Icon } from '@/components/Icon';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
} from '@/data/repositories';

interface RemainingOccasion {
  profileId: string;
  profileName: string;
  remaining: number;
  typicalValueCents: number;
}

const VERDICT_STYLE: Record<SimulatorVerdict, { icon: string; className: string }> = {
  ok: { icon: 'check_circle', className: 'text-success' },
  attention: { icon: 'error', className: 'text-warning' },
  risk: { icon: 'warning', className: 'text-error' },
};

// R6-20: quick value chips (same spirit as the outing quick-add buttons).
const QUICK_AMOUNT_CENTS = [500, 1000, 2000];

function formatWholeMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(getActiveIntlLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(fromCents(cents));
}

function formatDays(days: number): string {
  return new Intl.NumberFormat(getActiveIntlLocale(), { maximumFractionDigits: 1 }).format(days);
}

export function SimulatorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, links, envelopes, transactions, occurrences } = useAppData();

  const [amount, setAmount] = useState(() => {
    const prefill = searchParams.get('amount');
    if (!prefill) return '';
    const parsed = parseFloat(prefill);
    return Number.isNaN(parsed) || parsed <= 0 ? '' : String(parsed);
  });
  const [remainingOccasions, setRemainingOccasions] = useState<RemainingOccasion[]>([]);

  // BUG-002 (R6-02): resolveActivePhase keeps the simulator usable on boundary days.
  const activePhase = resolveActivePhase(phases);
  const primaryPool = pools.find((p) => p.scope === 'linked_phases');

  // DEC-094 (R-12): the plan perspective needs the remaining planned occasions.
  useEffect(() => {
    if (!trip || !activePhase || !primaryPool) return;
    let cancelled = false;
    const load = async () => {
      const [profiles, plan, settings] = await Promise.all([
        activityProfileRepository.getByTripId(trip.id),
        scenarioPlanRepository.getActiveByPhaseAndPool(trip.id, activePhase.id, primaryPool.id),
        phaseProfileSettingRepository.getByPhaseId(activePhase.id),
      ]);
      const allocations = plan
        ? await scenarioAllocationItemRepository.getByPlanId(plan.id)
        : [];
      if (cancelled) return;
      const enabled = profiles.filter((p) =>
        isProfileEnabledInPhase(settings, activePhase.id, p.id),
      );
      const forecasts = calculateOccasionForecasts(
        enabled,
        allocations,
        transactions,
        activePhase.id,
      );
      setRemainingOccasions(
        forecasts
          .filter((f) => f.remaining > 0)
          .map((f) => ({
            profileId: f.profileId,
            profileName: f.profileName,
            remaining: f.remaining,
            typicalValueCents:
              enabled.find((p) => p.id === f.profileId)?.typicalValueCents ?? 0,
          })),
      );
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [trip, activePhase, primaryPool, transactions]);

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

  // DEC-088/DEC-094: the day perspective uses today's allowance (R-06 engine).
  const todayIso = localDateString(new Date());
  const todayBudget =
    fts && activePhase
      ? calculateTodayFreeBudget(
          fts.freeToSpendCents,
          primaryPool
            ? calculateSpentOnDate(filterTransactionsByPool(transactions, primaryPool.id), todayIso)
            : 0,
          activePhase,
          todayIso,
        )
      : null;

  const amountCents = amount ? toCents(parseFloat(amount) || 0) : 0;
  const result =
    fts && amountCents > 0
      ? simulateSpendMultiMetric({
          amountCents,
          freeToSpendCents: fts.freeToSpendCents,
          todayAllowanceCents:
            todayBudget && todayBudget.todayAllowanceCents > 0
              ? todayBudget.todayAllowanceCents
              : null,
          remainingOccasions,
        })
      : null;

  // R6-19: expose the derivation behind the plan metric (top impact only).
  const topPlanImpact = result?.planImpacts[0] ?? null;
  const topPlanTypical = topPlanImpact
    ? (remainingOccasions.find((o) => o.profileId === topPlanImpact.profileId)
        ?.typicalValueCents ?? null)
    : null;

  if (!trip) return null;

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 pb-4 pt-2 min-h-screen px-[var(--page-padding-x)]">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('simulator.title')}</h1>
      </div>

      {fts && (
        <div className="bg-surface-container rounded-xl p-4">
          <p className="text-xs text-on-surface-faint">{t('simulator.available')}</p>
          <p className="text-lg font-bold tabular text-on-surface">
            {formatMoney(fts.freeToSpendCents, trip.baseCurrency)}
          </p>
        </div>
      )}

      <div className="bg-surface-container rounded-2xl p-5">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('simulator.how_much')}</label>
        <div className="flex items-baseline gap-1">
          <span className="text-on-surface-dim text-lg">{trip.baseCurrency}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="bg-transparent text-display font-bold text-on-surface tabular outline-none w-full"
            autoFocus
          />
        </div>
        {/* R6-20: quick value chips */}
        <div className="flex gap-2 mt-3">
          {QUICK_AMOUNT_CENTS.map((cents) => (
            <button
              key={cents}
              onClick={() => setAmount(String(fromCents(cents)))}
              className={`px-4 py-2 rounded-lg text-xs font-bold tabular btn-press ${
                amountCents === cents
                  ? 'bg-primary text-on-surface'
                  : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {formatWholeMoney(cents, trip.baseCurrency)}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <>
          {/* Verdict — the worst of the 3 perspectives sets the tone */}
          <div className="bg-surface-container rounded-xl p-5 text-center">
            <Icon
              name={result.total.canSpend ? VERDICT_STYLE[result.verdict].icon : 'cancel'}
              size={48}
              className={`mx-auto mb-2 ${
                result.total.canSpend ? VERDICT_STYLE[result.verdict].className : 'text-error'
              }`}
            />
            <p
              className={`text-lg font-bold ${
                result.total.canSpend ? VERDICT_STYLE[result.verdict].className : 'text-error'
              }`}
            >
              {result.total.canSpend
                ? t(`simulator.verdict_${result.verdict}`)
                : t('simulator.exceeded')}
            </p>
          </div>

          {/* Perspective 1 — of the total */}
          <MetricCard
            icon="account_balance_wallet"
            label={t('simulator.metric_total_label')}
            text={t('simulator.metric_total_text', {
              after: formatMoney(Math.max(0, result.total.freeAfterCents), trip.baseCurrency),
              percent: result.total.percentOfRemaining,
            })}
            math={t('simulator.math_total', {
              free: formatMoney(fts!.freeToSpendCents, trip.baseCurrency),
              amount: formatMoney(amountCents, trip.baseCurrency),
              after: formatMoney(result.total.freeAfterCents, trip.baseCurrency),
            })}
          />

          {/* Perspective 2 — of the day-to-day */}
          <MetricCard
            icon="today"
            label={t('simulator.metric_daily_label')}
            text={
              result.allowanceDays !== null && result.dailyAllowanceCents !== null
                ? t('simulator.metric_daily_days', {
                    amount: formatMoney(amountCents, trip.baseCurrency),
                    days: result.allowanceDays,
                    daily: formatMoney(result.dailyAllowanceCents, trip.baseCurrency),
                  })
                : t('simulator.metric_daily_none')
            }
            math={
              result.allowanceDays !== null && result.dailyAllowanceCents !== null
                ? t('simulator.math_daily', {
                    amount: formatMoney(amountCents, trip.baseCurrency),
                    daily: formatMoney(result.dailyAllowanceCents, trip.baseCurrency),
                    days: formatDays(result.allowanceDays),
                  })
                : null
            }
            highlight={result.allowanceDays !== null && result.allowanceDays > 3}
          />

          {/* Perspective 3 — of the plan */}
          <MetricCard
            icon="event_note"
            label={t('simulator.metric_plan_label')}
            text={
              result.planImpacts.length > 0
                ? result.planImpacts
                    .map((impact) =>
                      t('simulator.metric_plan_item', {
                        count: impact.occasionsLost,
                        name: impact.profileName.toLowerCase(),
                      }),
                    )
                    .join(' · ')
                : t('simulator.metric_plan_none')
            }
            math={
              topPlanImpact && topPlanTypical
                ? t('simulator.math_plan', {
                    amount: formatMoney(amountCents, trip.baseCurrency),
                    typical: formatMoney(topPlanTypical, trip.baseCurrency),
                    count: topPlanImpact.occasionsLost,
                    name: topPlanImpact.profileName.toLowerCase(),
                  })
                : null
            }
            highlight={result.planImpacts.reduce((sum, i) => sum + i.occasionsLost, 0) >= 2}
          />

          {/* R6-21: post-verdict CTAs */}
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/quick-add?amount=${encodeURIComponent(amount)}`)}
              className="flex-1 py-3 rounded-xl bg-primary text-on-surface text-sm font-semibold btn-press"
            >
              {t('simulator.cta_register')}
            </button>
            <button
              onClick={() => navigate('/planner')}
              className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim text-sm font-semibold btn-press"
            >
              {t('simulator.cta_planner')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  text,
  math,
  highlight,
}: {
  icon: string;
  label: string;
  text: string;
  /** R6-19: one-line derivation behind the verdict ("the math"). */
  math?: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-4 flex items-start gap-3">
      <Icon name={icon} size={18} className={highlight ? 'text-warning' : 'text-primary'} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
          {label}
        </p>
        <p
          className={`text-[13px] font-semibold leading-snug mt-1 ${
            highlight ? 'text-warning' : 'text-on-surface'
          }`}
        >
          {text}
        </p>
        {math && (
          <p className="text-[11px] tabular text-on-surface-faint mt-1">{math}</p>
        )}
      </div>
    </div>
  );
}
