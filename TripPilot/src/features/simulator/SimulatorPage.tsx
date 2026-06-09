import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { findActivePhase } from '@/domain/dates';
import { calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { simulateSpend } from '@/domain/forecasting';
import { toCents, formatMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';

export function SimulatorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, links, envelopes, transactions } = useAppData();

  // Pre-filled when arriving from the Amigo Sincero card (DEC-050).
  const [amount, setAmount] = useState(() => {
    const prefill = searchParams.get('amount');
    if (!prefill) return '';
    const parsed = parseFloat(prefill);
    return Number.isNaN(parsed) || parsed <= 0 ? '' : String(parsed);
  });

  const activePhase = findActivePhase(phases);
  const primaryPool = pools.find((p) => p.scope === 'linked_phases');

  const fts = primaryPool && activePhase
    ? calculateFreeToSpend(
        primaryPool,
        envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
        filterTransactionsByPool(transactions, primaryPool.id),
        links.filter((l) => l.budgetPoolId === primaryPool.id),
        activePhase.id,
      )
    : null;

  const amountCents = amount ? toCents(parseFloat(amount) || 0) : 0;
  const result = fts && amountCents > 0 ? simulateSpend(fts.freeToSpendCents, amountCents) : null;

  if (!trip) return null;

  const riskColors = {
    low: 'text-success',
    medium: 'text-warning',
    high: 'text-error',
    critical: 'text-error',
  };

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 pb-4 pt-2 min-h-screen px-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
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
      </div>

      {result && (
        <div className="bg-surface-container rounded-xl p-5 text-center">
          <Icon
            name={result.canSpend ? 'check_circle' : 'cancel'}
            size={48}
            className={`mx-auto mb-2 ${result.canSpend ? 'text-success' : 'text-error'}`}
          />
          <p className={`text-lg font-bold ${riskColors[result.risk]}`}>
            {t(`simulator.risk_${result.risk}`)}
          </p>
          <p className="text-sm text-on-surface-dim mt-2">
            {t('simulator.after', { amount: formatMoney(Math.max(0, result.freeAfterCents), trip.baseCurrency) })}
          </p>
          <p className="text-xs text-on-surface-faint mt-1">
            {t('simulator.percent_used', { percent: result.percentOfRemaining })}
          </p>
        </div>
      )}
    </div>
  );
}
