import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { formatMoney } from '@/domain/money';
import { createPoolSummary } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { Icon } from '@/components/Icon';

export function PlannerPage() {
  const { t } = useTranslation();
  const { trip, pools, transactions, envelopes, phases, loading } = useAppData();

  if (loading || !trip) return <p className="p-4 text-on-surface-dim">{t('common.loading')}</p>;

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <h1 className="text-heading font-bold text-on-surface">{t('planner.title')}</h1>

      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('planner.funds')}
        </p>
        {pools.map((pool) => {
          const poolTxs = filterTransactionsByPool(transactions, pool.id);
          const summary = createPoolSummary(pool, poolTxs);
          const poolEnvelopes = envelopes.filter((e) => e.budgetPoolId === pool.id);
          const reserve = poolEnvelopes.find((e) => e.kind === 'protected_reserve');

          return (
            <div key={pool.id} className="bg-surface-container rounded-xl p-4 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-on-surface">{pool.name}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-high text-on-surface-faint">
                  {pool.scope === 'global' ? 'Global' : 'Fases'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-on-surface-faint">{t('dashboard.fund_balance')}</p>
                  <p className="font-semibold tabular text-on-surface">{formatMoney(summary.remainingCents, pool.currency)}</p>
                </div>
                {reserve && (
                  <div>
                    <p className="text-on-surface-faint">{t('planner.protected_reserve')}</p>
                    <p className="font-semibold tabular text-on-surface">{formatMoney(reserve.amountCents, pool.currency)}</p>
                  </div>
                )}
              </div>

              {poolEnvelopes.filter((e) => e.kind === 'allocation').length > 0 && (
                <div className="mt-3 pt-3 border-t border-on-surface-mute">
                  {poolEnvelopes.filter((e) => e.kind === 'allocation').map((env) => (
                    <div key={env.id} className="flex justify-between py-1">
                      <span className="text-xs text-on-surface-dim">{env.name}</span>
                      <span className="text-xs font-semibold tabular text-on-surface">{formatMoney(env.amountCents, pool.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('planner.phases')}
        </p>
        {phases.map((phase) => (
          <div key={phase.id} className="bg-surface-container rounded-xl p-4 mb-2 flex items-center gap-3">
            <Icon name="calendar_today" size={20} className="text-on-surface-dim" />
            <div>
              <p className="text-sm font-medium text-on-surface">{phase.name}</p>
              <p className="text-xs text-on-surface-faint">{phase.startDate} → {phase.endDate}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
