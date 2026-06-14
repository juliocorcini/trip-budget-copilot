import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase, getDaysRemaining, formatDate } from '@/domain/dates';
import { calculateFreeToSpend, buildRescuePlan, type RescueOccasionInput } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { calculateOccasionForecasts } from '@/domain/forecasting';
import { isProfileEnabledInPhase } from '@/domain/profiles';
import { toCents, fromCents, formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { LoadingScreen } from '@/components/LoadingScreen';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
} from '@/data/repositories';

// Quick "save this much" chips, mirroring the simulator pattern (R6-20).
const QUICK_TARGET_CENTS = [2000, 5000, 10000];

function formatWholeMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(getActiveIntlLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(fromCents(cents));
}

/**
 * DEC-132: rescue mode — a calculator for "I need to save €X by the end of
 * the phase". Shows the new daily allowance and which planned occasions to
 * skip. Nothing is persisted; the plan stays untouched.
 */
export function RescuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, links, envelopes, transactions, occurrences, plannedPurchases, loading, error, retry } = useAppData();

  const [amount, setAmount] = useState('');
  const [remainingOccasions, setRemainingOccasions] = useState<RescueOccasionInput[]>([]);

  const activePhase = resolveActivePhase(phases);
  const primaryPool = pools.find((p) => p.scope === 'linked_phases');

  // Same loading pattern as the simulator (DEC-116): plan + enabled profiles.
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

  // BUG-014: never blank out on a DB error — offer recovery instead of a
  // white screen, and only go to onboarding when there is genuinely no trip.
  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <LoadingScreen />;
    return <Navigate to="/welcome" replace />;
  }
  const currency = trip.baseCurrency;

  const remainingDays = activePhase ? getDaysRemaining(activePhase.endDate) + 1 : 0;
  const amountCents = amount ? toCents(parseFloat(amount) || 0) : 0;

  const plan =
    fts && activePhase && amountCents > 0
      ? buildRescuePlan({
          saveTargetCents: amountCents,
          freeToSpendCents: fts.freeToSpendCents,
          remainingDays,
          remainingOccasions,
        })
      : null;

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 pb-4 pt-2 min-h-screen px-[var(--page-padding-x)]">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('rescue.title')}</h1>
      </div>

      <p className="text-sm text-on-surface-dim leading-snug">{t('rescue.intro')}</p>

      {fts && activePhase && (
        <div className="bg-surface-container rounded-xl p-4">
          <p className="text-xs text-on-surface-faint">{t('rescue.context_label')}</p>
          <p className="text-lg font-bold tabular text-on-surface mt-0.5">
            {t('rescue.context_value', {
              free: formatMoney(fts.freeToSpendCents, currency),
              days: remainingDays,
            })}
          </p>
        </div>
      )}

      <div className="bg-surface-container rounded-2xl p-5">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('rescue.how_much')}</label>
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
        <div className="flex gap-2 mt-3">
          {QUICK_TARGET_CENTS.map((cents) => (
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

      {amountCents === 0 && (
        <p className="text-xs text-on-surface-faint text-center -mt-1">
          {t('rescue.empty_hint')}
        </p>
      )}

      {plan && !plan.feasible && fts && (
        <div className="bg-surface-container rounded-xl p-5 text-center">
          <Icon name="warning" size={42} className="mx-auto mb-2 text-error" />
          <p className="text-sm font-bold text-error">
            {t('rescue.infeasible', {
              target: formatMoney(plan.saveTargetCents, currency),
              free: formatMoney(fts.freeToSpendCents, currency),
            })}
          </p>
        </div>
      )}

      {plan && plan.feasible && (
        <>
          <div className="bg-surface-container rounded-2xl p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-faint">
              {t('rescue.new_daily')}
            </p>
            <p className="text-[40px] font-extrabold tabular leading-none mt-2 text-on-surface">
              {formatMoney(plan.newDailyFreeCents, currency)}
            </p>
            <p className="text-xs font-semibold text-on-surface-dim mt-2">
              {t('rescue.instead_of', {
                current: formatMoney(plan.currentDailyFreeCents, currency),
              })}
            </p>
            {activePhase && (
              <p className="text-xs font-bold mt-3" style={{ color: 'var(--warning)' }}>
                {t('rescue.daily_cut', {
                  cut: formatMoney(plan.dailyCutCents, currency),
                  date: formatDate(activePhase.endDate, 'dd/MM'),
                })}
              </p>
            )}
          </div>

          {plan.suggestions.length > 0 && (
            <div className="bg-surface-container rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-faint mb-3">
                {t('rescue.suggestions_title')}
              </p>
              <div className="flex flex-col gap-2">
                {plan.suggestions.map((s) => (
                  <div
                    key={s.profileId}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-high"
                  >
                    <p className="text-sm font-semibold text-on-surface">
                      {/* "n", not "count" — count triggers i18next pluralization */}
                      {t('rescue.suggestion_item', { n: s.skipCount, name: s.profileName })}
                    </p>
                    <p className="text-sm font-extrabold tabular text-success">
                      {t('rescue.suggestion_savings', {
                        amount: formatMoney(s.savingsCents, currency),
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-semibold text-on-surface-dim mt-3">
                {plan.coveredBySuggestionsCents >= plan.saveTargetCents
                  ? t('rescue.covered_full', {
                      target: formatMoney(plan.saveTargetCents, currency),
                    })
                  : t('rescue.covered_partial', {
                      covered: formatMoney(plan.coveredBySuggestionsCents, currency),
                      target: formatMoney(plan.saveTargetCents, currency),
                    })}
              </p>
            </div>
          )}

          <p className="text-xs text-on-surface-faint text-center">{t('rescue.note')}</p>
        </>
      )}
    </div>
  );
}
