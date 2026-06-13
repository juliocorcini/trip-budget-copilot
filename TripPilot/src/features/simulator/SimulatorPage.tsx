import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase, localDateString } from '@/domain/dates';
import { calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool, calculateSpentOnDate } from '@/domain/transactions';
import { calculateTodayFreeBudget } from '@/domain/phases';
import {
  simulateContextualSpend,
  calculateOccasionForecasts,
  type SimulationTarget,
  type SimulationProfileContext,
  type SimulationEventContext,
  type SimulationFact,
  type ContextualVerdict,
  type ContextualVerdictTone,
} from '@/domain/forecasting';
import { isProfileEnabledInPhase } from '@/domain/profiles';
import { toCents, fromCents, formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { LoadingScreen } from '@/components/LoadingScreen';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
} from '@/data/repositories';

const VERDICT_STYLE: Record<ContextualVerdictTone, { icon: string; className: string }> = {
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

interface ProfileChip extends SimulationProfileContext {
  category: string | null;
}

export function SimulatorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, links, envelopes, transactions, occurrences, loading, error, retry } = useAppData();

  const [amount, setAmount] = useState(() => {
    const prefill = searchParams.get('amount');
    if (!prefill) return '';
    const parsed = parseFloat(prefill);
    return Number.isNaN(parsed) || parsed <= 0 ? '' : String(parsed);
  });
  // DEC-116 (R-07): the simulator asks WHERE the money goes.
  const [target, setTarget] = useState<SimulationTarget | null>(null);
  const [profileChips, setProfileChips] = useState<ProfileChip[]>([]);

  // BUG-002 (R6-02): resolveActivePhase keeps the simulator usable on boundary days.
  const activePhase = resolveActivePhase(phases);
  const primaryPool = pools.find((p) => p.scope === 'linked_phases');

  // DEC-116: the engine needs plan numbers for EVERY enabled profile —
  // including the ones without an allocation (plannedQuantity 0).
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
      setProfileChips(
        enabled.map((profile) => {
          const forecast = forecasts.find((f) => f.profileId === profile.id);
          return {
            profileId: profile.id,
            profileName: profile.name,
            category: profile.category,
            plannedQuantity: forecast?.totalPlanned ?? 0,
            doneQuantity: forecast?.spent ?? 0,
            remaining: forecast?.remaining ?? 0,
            typicalValueCents: profile.typicalValueCents,
          };
        }),
      );
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [trip, activePhase, primaryPool, transactions]);

  // Upcoming events of the phase (unconfirmed) — they may have reserves.
  const eventChips: SimulationEventContext[] = occurrences
    .filter(
      (o) =>
        o.deletedAt === null &&
        activePhase !== null &&
        o.phaseId === activePhase.id &&
        !o.isConfirmed,
    )
    .map((o) => ({
      occurrenceId: o.id,
      name: o.name,
      reservedCents: o.reservedCents ?? 0,
    }));

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
    fts && amountCents > 0 && target !== null
      ? simulateContextualSpend({
          amountCents,
          target,
          freeToSpendCents: fts.freeToSpendCents,
          todayAllowanceCents:
            todayBudget && todayBudget.todayAllowanceCents > 0
              ? todayBudget.todayAllowanceCents
              : null,
          profiles: profileChips,
          events: eventChips,
        })
      : null;

  // BUG-014: recovery screen on DB error instead of a blank page.
  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <LoadingScreen />;
    return <Navigate to="/welcome" replace />;
  }

  const currency = trip.baseCurrency;

  const isTargetSelected = (candidate: SimulationTarget): boolean => {
    if (target === null) return false;
    if (target.kind !== candidate.kind) return false;
    if (target.kind === 'profile' && candidate.kind === 'profile') {
      return target.profileId === candidate.profileId;
    }
    if (target.kind === 'event' && candidate.kind === 'event') {
      return target.occurrenceId === candidate.occurrenceId;
    }
    return true;
  };

  const targetProfile =
    target?.kind === 'profile'
      ? profileChips.find((p) => p.profileId === target.profileId) ?? null
      : null;

  const registerHref = targetProfile?.category
    ? `/quick-add?amount=${encodeURIComponent(amount)}&cat=${encodeURIComponent(targetProfile.category)}`
    : `/quick-add?amount=${encodeURIComponent(amount)}`;

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
            {formatMoney(fts.freeToSpendCents, currency)}
          </p>
        </div>
      )}

      <div className="bg-surface-container rounded-2xl p-5">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('simulator.how_much')}</label>
        <div className="flex items-baseline gap-1">
          <span className="text-on-surface-dim text-lg">{currency}</span>
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
              {formatWholeMoney(cents, currency)}
            </button>
          ))}
        </div>
      </div>

      {/* DEC-116: WHERE will you spend? — profiles + events + other */}
      {amountCents > 0 && (
        <div className="bg-surface-container rounded-2xl p-5">
          <label className="text-xs text-on-surface-faint mb-2 block">
            {t('simulator.where_question')}
          </label>
          <div className="flex gap-2 flex-wrap">
            {profileChips.map((profile) => {
              const candidate: SimulationTarget = { kind: 'profile', profileId: profile.profileId };
              return (
                <button
                  key={profile.profileId}
                  onClick={() => setTarget(candidate)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium btn-press flex items-center gap-1.5 ${
                    isTargetSelected(candidate)
                      ? 'bg-primary text-on-surface'
                      : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  <Icon name={getCategoryIcon(profile.category)} size={14} />
                  {profile.profileName}
                </button>
              );
            })}
            {eventChips.map((event) => {
              const candidate: SimulationTarget = { kind: 'event', occurrenceId: event.occurrenceId };
              return (
                <button
                  key={event.occurrenceId}
                  onClick={() => setTarget(candidate)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium btn-press flex items-center gap-1.5 ${
                    isTargetSelected(candidate)
                      ? 'bg-primary text-on-surface'
                      : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  <Icon name="event" size={14} />
                  {event.name}
                </button>
              );
            })}
            <button
              onClick={() => setTarget({ kind: 'other' })}
              className={`px-3 py-2 rounded-lg text-xs font-medium btn-press ${
                isTargetSelected({ kind: 'other' })
                  ? 'bg-primary text-on-surface'
                  : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {t('simulator.target_other')}
            </button>
          </div>
        </div>
      )}

      {result && (
        <>
          {/* Verdict with the WHY — never a tone without its reason (DEC-116) */}
          <div className="bg-surface-container rounded-xl p-5 text-center">
            <Icon
              name={VERDICT_STYLE[result.verdict.tone].icon}
              size={48}
              className={`mx-auto mb-2 ${VERDICT_STYLE[result.verdict.tone].className}`}
            />
            <p className={`text-lg font-bold ${VERDICT_STYLE[result.verdict.tone].className}`}>
              {t(`simulator.verdict_${result.verdict.tone}`)}
            </p>
            <p className="text-[13px] font-semibold leading-snug mt-2 text-on-surface">
              {formatVerdictReason(result.verdict, currency, t)}
            </p>
          </div>

          {/* Facts — every number named and explained */}
          {result.facts.map((fact, i) => (
            <FactCard key={`${fact.kind}-${i}`} text={formatFact(fact, currency, t)} />
          ))}

          {/* R6-21: post-verdict CTAs */}
          <div className="flex gap-2">
            <button
              onClick={() => navigate(registerHref)}
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

      {/* DEC-132: cross-link — the inverse question ("how do I save €X?") */}
      <button
        onClick={() => navigate('/rescue')}
        className="py-3 rounded-xl bg-surface-container text-on-surface-dim text-xs font-semibold btn-press flex items-center justify-center gap-2"
      >
        <Icon name="sos" size={14} className="text-primary" />
        {t('rescue.entry_from_simulator')}
      </button>
    </div>
  );
}

type TFn = (key: string, params?: Record<string, unknown>) => string;

/** DEC-116: facts → full labeled sentences. Raw equations are banned. */
function formatFact(fact: SimulationFact, currency: string, t: TFn): string {
  switch (fact.kind) {
    case 'free_impact':
      return t('simulator.fact_free_impact', {
        free: formatMoney(fact.freeCents, currency),
        after: formatMoney(fact.afterCents, currency),
      });
    case 'exceeds_free':
      return t('simulator.fact_exceeds_free', {
        free: formatMoney(fact.freeCents, currency),
        amount: formatMoney(fact.amountCents, currency),
        missing: formatMoney(fact.missingCents, currency),
      });
    case 'daily_fits':
      return t('simulator.fact_daily_fits', {
        allowance: formatMoney(fact.allowanceCents, currency),
        amount: formatMoney(fact.amountCents, currency),
      });
    case 'daily_days':
      return t('simulator.fact_daily_days', {
        allowance: formatMoney(fact.allowanceCents, currency),
        amount: formatMoney(fact.amountCents, currency),
        days: formatDays(fact.days),
      });
    case 'plan_consumption':
      return t('simulator.fact_plan_consumption', {
        occasions: formatDays(fact.occasions),
        remaining: fact.remaining,
        name: fact.profileName.toLowerCase(),
        typical: formatMoney(fact.typicalValueCents, currency),
      });
    case 'plan_over':
      return t('simulator.fact_plan_over', {
        name: fact.profileName.toLowerCase(),
        done: fact.done,
        planned: fact.planned,
      });
    case 'event_reserve_covers':
      return t('simulator.fact_event_reserve_covers', {
        reserved: formatMoney(fact.reservedCents, currency),
        event: fact.eventName,
        left: formatMoney(fact.leftCents, currency),
      });
    case 'event_reserve_short':
      return t('simulator.fact_event_reserve_short', {
        reserved: formatMoney(fact.reservedCents, currency),
        event: fact.eventName,
        missing: formatMoney(fact.missingCents, currency),
      });
    case 'event_no_reserve':
      return t('simulator.fact_event_no_reserve', { event: fact.eventName });
  }
}

/** DEC-116: the verdict always states its concrete reason. */
function formatVerdictReason(verdict: ContextualVerdict, currency: string, t: TFn): string {
  switch (verdict.reason) {
    case 'reserve_covers':
      return t('simulator.reason_reserve_covers', { event: verdict.eventName });
    case 'fits_plan':
      return t('simulator.reason_fits_plan', {
        remaining: verdict.remaining,
        name: verdict.profileName.toLowerCase(),
      });
    case 'fits_free':
      return t('simulator.reason_fits_free');
    case 'consumes_occasions':
      return t('simulator.reason_consumes_occasions', {
        occasions: formatDays(verdict.occasions),
        name: verdict.profileName.toLowerCase(),
      });
    case 'reserve_short':
      return t('simulator.reason_reserve_short', {
        event: verdict.eventName,
        missing: formatMoney(verdict.missingCents, currency),
      });
    case 'many_days':
      return t('simulator.reason_many_days', { days: formatDays(verdict.days) });
    case 'large_share':
      return t('simulator.reason_large_share', { percent: verdict.percent });
    case 'consumes_whole_plan':
      return t('simulator.reason_consumes_whole_plan', {
        name: verdict.profileName.toLowerCase(),
      });
    case 'over_plan':
      return t('simulator.reason_over_plan', { name: verdict.profileName.toLowerCase() });
    case 'exceeds_free':
      return t('simulator.reason_exceeds_free', {
        missing: formatMoney(verdict.missingCents, currency),
      });
  }
}

function FactCard({ text }: { text: string }) {
  return (
    <div className="bg-surface-container rounded-xl p-4 flex items-start gap-3">
      <Icon name="info" size={18} className="text-primary" />
      <p className="text-[13px] font-semibold leading-snug text-on-surface flex-1 min-w-0">
        {text}
      </p>
    </div>
  );
}
