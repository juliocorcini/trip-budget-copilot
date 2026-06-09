import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { formatMoney, sumCents } from '@/domain/money';
import { formatShortDate } from '@/domain/dates';
import { getUnassignedTransactionCount } from '@/domain/wallets';
import { Icon } from '@/components/Icon';

type FilterCategory = string | null;

export function ExpenseListPage() {
  const { t } = useTranslation();
  const { trip, transactions, pools, wallets, loading } = useAppData();
  const [filterCategory, setFilterCategory] = useState<FilterCategory>(null);
  const [filterWalletNull, setFilterWalletNull] = useState(false);

  if (loading || !trip) return <p className="p-4 text-on-surface-dim">{t('common.loading')}</p>;

  const expenses = transactions
    .filter((tx) => tx.type === 'expense' && tx.deletedAt === null)
    .filter((tx) => !filterCategory || tx.category === filterCategory)
    .filter((tx) => !filterWalletNull || tx.walletId === null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalCents = sumCents(expenses.map((tx) => tx.amountCents));
  const unassigned = getUnassignedTransactionCount(transactions);

  const poolMap = new Map(pools.map((p) => [p.id, p.name]));
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));

  const categories = [...new Set(transactions.filter((tx) => tx.category).map((tx) => tx.category!))];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-heading font-bold text-on-surface">{t('expenses.title')}</h1>
        <p className="text-sm font-semibold tabular text-on-surface">
          {formatMoney(totalCents, trip.baseCurrency)}
        </p>
      </div>

      {unassigned > 0 && !filterWalletNull && (
        <button
          onClick={() => setFilterWalletNull(true)}
          className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-2 text-left btn-press"
        >
          <p className="text-sm text-warning">
            {t('expenses.unassigned_wallet_warning', { count: unassigned })}
          </p>
          <p className="text-xs text-warning/70 mt-0.5">{t('expenses.review_now')}</p>
        </button>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <FilterChip
          label={t('expenses.title')}
          active={!filterCategory && !filterWalletNull}
          onClick={() => { setFilterCategory(null); setFilterWalletNull(false); }}
        />
        {filterWalletNull && (
          <FilterChip
            label={t('expenses.filter_no_wallet')}
            active
            onClick={() => setFilterWalletNull(false)}
          />
        )}
        {categories.map((cat) => (
          <FilterChip
            key={cat}
            label={t(`categories.${cat}` as never)}
            active={filterCategory === cat}
            onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
          />
        ))}
      </div>

      {expenses.length === 0 ? (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="receipt_long" size={32} className="text-on-surface-mute mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">{t('dashboard.no_expenses')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {expenses.map((tx) => (
            <div key={tx.id} className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">{tx.description}</p>
                <div className="flex gap-2 text-xs text-on-surface-faint mt-0.5">
                  <span>{tx.category ? t(`categories.${tx.category}` as never) : ''}</span>
                  <span>·</span>
                  <span>{formatShortDate(tx.date.slice(0, 10))}</span>
                  {tx.budgetPoolId && (
                    <>
                      <span>·</span>
                      <span>{poolMap.get(tx.budgetPoolId) ?? ''}</span>
                    </>
                  )}
                </div>
                {tx.walletId === null && (
                  <p className="text-xs text-warning mt-0.5">{t('expenses.wallet_not_set')}</p>
                )}
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-semibold tabular text-on-surface">
                  {formatMoney(tx.amountCents, tx.currency)}
                </p>
                {tx.walletId && (
                  <p className="text-xs text-on-surface-faint">{walletMap.get(tx.walletId) ?? ''}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium btn-press transition-colors ${
        active
          ? 'bg-primary text-on-surface'
          : 'bg-surface-high text-on-surface-dim'
      }`}
    >
      {label}
    </button>
  );
}
