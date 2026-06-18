import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { calculateWalletBalance } from '@/domain/wallets';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Phase } from '@/domain/types/phase';
import type { Envelope } from '@/domain/types/envelope';
import type { Wallet } from '@/domain/types/wallet';
import type { Transaction } from '@/domain/types/transaction';

interface AdvancedTripViewProps {
  pools: BudgetPool[];
  links: BudgetPoolPhaseLink[];
  phases: Phase[];
  envelopes: Envelope[];
  wallets: Wallet[];
  transactions: Transaction[];
  baseCurrency: string;
}

/**
 * GATE 6 / D17 — "Visão avançada da viagem". The happy path hides the
 * fund/pool/link/envelope/wallet vocabulary; this surfaces the RAW backend for
 * the curious (read), and deep-links to the existing `/funds` and `/wallets`
 * editors (edit) — no duplicated editor logic. Soft-deleted rows are excluded.
 */
export function AdvancedTripView({
  pools,
  links,
  phases,
  envelopes,
  wallets,
  transactions,
  baseCurrency,
}: AdvancedTripViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const activePools = pools.filter((p) => p.deletedAt === null);
  const activeLinks = links.filter((l) => l.deletedAt === null);
  const activeEnvelopes = envelopes.filter((e) => e.deletedAt === null);
  const activeWallets = wallets.filter((w) => w.deletedAt === null);
  const phaseName = (id: string) => phases.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-on-surface-faint">{t('settings.advanced_trip_hint')}</p>

      <div>
        <p className="text-xs font-semibold text-on-surface-dim mb-2">
          {t('settings.advanced_funds', { count: activePools.length })}
        </p>
        <div className="flex flex-col gap-2">
          {activePools.map((pool) => {
            const linkedNames = activeLinks
              .filter((l) => l.budgetPoolId === pool.id)
              .map((l) => phaseName(l.phaseId));
            const poolEnvelopes = activeEnvelopes.filter((e) => e.budgetPoolId === pool.id);
            return (
              <div key={pool.id} className="bg-surface-high rounded-lg p-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm font-medium text-on-surface truncate">{pool.name}</span>
                  <span className="text-sm tabular text-on-surface-dim shrink-0">
                    {formatMoney(pool.totalAmountCents, pool.currency)}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-faint mt-1">
                  <span className="font-mono">{pool.scope}</span>
                  {pool.scope === 'linked_phases' &&
                    linkedNames.length > 0 &&
                    ` → ${linkedNames.join(', ')}`}
                  {pool.scope === 'global' &&
                    pool.dateStart != null &&
                    ` · ${pool.dateStart}${pool.dateEnd != null ? `–${pool.dateEnd}` : ''}`}
                  {pool.scope === 'global' &&
                    pool.goalCents != null &&
                    ` · ${t('settings.advanced_goal')} ${formatMoney(pool.goalCents, pool.currency)}`}
                </p>
                {poolEnvelopes.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {poolEnvelopes.map((env) => (
                      <li
                        key={env.id}
                        className="text-[11px] text-on-surface-faint flex justify-between gap-2"
                      >
                        <span className="truncate">
                          <span className="font-mono">{env.kind}</span> · {env.name}
                        </span>
                        <span className="tabular shrink-0">
                          {formatMoney(env.amountCents, pool.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-on-surface-dim mb-2">
          {t('settings.advanced_wallets', { count: activeWallets.length })}
        </p>
        <div className="flex flex-col gap-2">
          {activeWallets.map((wallet) => {
            const balance = calculateWalletBalance(wallet, transactions, baseCurrency);
            return (
              <div
                key={wallet.id}
                className="bg-surface-high rounded-lg p-3 flex justify-between items-center gap-2"
              >
                <span className="text-sm text-on-surface truncate">
                  {wallet.name}{' '}
                  <span className="font-mono text-[11px] text-on-surface-faint">
                    {wallet.walletType}
                  </span>
                </span>
                <span className="text-sm tabular text-on-surface-dim shrink-0">
                  {formatMoney(balance.currentBalanceCents, wallet.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-on-surface-faint">
        {t('settings.advanced_links', { count: activeLinks.length })} ·{' '}
        {t('settings.advanced_envelopes', { count: activeEnvelopes.length })}
      </p>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => navigate('/funds')}
          className="px-3 py-2 rounded-lg bg-surface-high text-on-surface-dim text-xs font-medium btn-press flex items-center gap-1.5"
        >
          <Icon name="savings" className="text-on-surface-faint" />
          {t('settings.advanced_manage_funds')}
        </button>
        <button
          onClick={() => navigate('/wallets')}
          className="px-3 py-2 rounded-lg bg-surface-high text-on-surface-dim text-xs font-medium btn-press flex items-center gap-1.5"
        >
          <Icon name="credit_card" className="text-on-surface-faint" />
          {t('settings.advanced_manage_wallets')}
        </button>
      </div>
    </div>
  );
}
