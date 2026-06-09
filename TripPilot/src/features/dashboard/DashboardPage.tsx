import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { findActivePhase, getDayNumber, formatDate } from '@/domain/dates';
import { calculateFreeToSpend, createPoolSummary } from '@/domain/budget';
import { getRecentTransactions, filterTransactionsByPool, groupTransactionsByCategory } from '@/domain/transactions';
import { formatMoney, fromCents } from '@/domain/money';
import { Icon } from '@/components/Icon';
import { useNavigate } from 'react-router';

function splitMoneyDisplay(cents: number, currency: string): { symbol: string; integer: string; decimal: string } {
  const value = fromCents(cents);
  const abs = Math.abs(value);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  const symbolMap: Record<string, string> = { EUR: '€', USD: '$', BRL: 'R$', GBP: '£' };
  const symbol = symbolMap[currency] ?? currency;

  return {
    symbol,
    integer: `${symbol}${intPart}`,
    decimal: `,${decPart.toString().padStart(2, '0')}`,
  };
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { trip, phases, pools, links, envelopes, transactions, loading, settings } = useAppData();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-on-surface-dim">{t('common.loading')}</p>
      </div>
    );
  }

  if (!trip || !settings?.onboardingCompleted) {
    navigate('/welcome');
    return null;
  }

  const activePhase = findActivePhase(phases);
  const dayNum = activePhase ? getDayNumber(activePhase.startDate) : null;
  const recent = getRecentTransactions(transactions, 5);

  const linkedPools = pools.filter((p) => p.scope === 'linked_phases');
  const primaryPool = linkedPools[0];
  const fts = primaryPool && activePhase
    ? calculateFreeToSpend(
        primaryPool,
        envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
        filterTransactionsByPool(transactions, primaryPool.id),
        links.filter((l) => l.budgetPoolId === primaryPool.id),
        activePhase.id,
      )
    : null;

  const categoryGroups = groupTransactionsByCategory(transactions);
  const barCount = categoryGroups['bar']?.length ?? 0;
  const marketCount = categoryGroups['market']?.length ?? 0;
  const restaurantCount = categoryGroups['restaurant']?.length ?? 0;
  const hasOccasionData = barCount > 0 || marketCount > 0 || restaurantCount > 0;

  const pendingShared = transactions.filter(
    (tx) => tx.isShared && tx.deletedAt === null && tx.type === 'expense',
  );
  const hasPendingExpenses = pendingShared.length > 0;
  const pendingImpactCents = pendingShared.reduce((sum, tx) => sum + tx.amountCents, 0);

  const personalPool = pools.find((p) => p.name?.toLowerCase().includes('pessoal') || p.name?.toLowerCase().includes('shopping'));
  const personalSummary = personalPool ? createPoolSummary(personalPool, filterTransactionsByPool(transactions, personalPool.id)) : null;

  const progressPercent = fts && fts.totalBudgetCents > 0
    ? Math.round((fts.totalSpentCents / fts.totalBudgetCents) * 100)
    : 0;

  const heroMoney = fts ? splitMoneyDisplay(fts.freeToSpendCents, trip.baseCurrency) : null;
  const remainingFundCents = fts ? fts.totalBudgetCents - fts.totalSpentCents : 0;

  return (
    <div className="flex flex-col pb-6">
      {/* HEADER */}
      {activePhase && dayNum !== null && (
        <div className="px-5 pt-6 pb-1 flex justify-between items-center">
          <div>
            <p
              className="text-[11px] tracking-[0.15em] uppercase font-bold"
              style={{ color: '#C75B39aa' }}
            >
              {t('dashboard.day_counter', {
                current: dayNum,
                end: formatDate(activePhase.endDate, "d 'de' MMMM"),
              })}
            </p>
            <h1 className="text-xl font-extrabold tracking-tight mt-1 text-on-surface">
              {activePhase.name || trip.name}
            </h1>
          </div>
          <div className="relative">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-container)' }}
            >
              <Icon name="notifications" size={20} className="text-primary" />
            </div>
            {hasPendingExpenses && (
              <div
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full"
                style={{ background: 'var(--primary)' }}
              />
            )}
          </div>
        </div>
      )}

      {/* HERO CARD */}
      {fts && heroMoney && (
        <div className="mx-5 mt-5 p-5 rounded-2xl bg-surface-container">
          <p
            className="text-xs font-bold"
            style={{ color: '#C75B39aa' }}
          >
            {t('dashboard.free_to_spend', {
              date: activePhase ? formatDate(activePhase.endDate, "d 'de' MMMM") : '',
            })}
          </p>
          <p className="text-[44px] font-extrabold tracking-tight leading-none mt-2 tabular text-on-surface">
            {heroMoney.integer}
            <span className="text-xl font-bold text-on-surface-dim">{heroMoney.decimal}</span>
          </p>
          <div
            className="w-full h-2 rounded-full overflow-hidden mt-4"
            style={{ background: 'var(--surface-container-high)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, progressPercent)}%`,
                background: 'linear-gradient(90deg, var(--success), var(--primary))',
              }}
            />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.fund_balance')}</span>
              <span className="text-xs font-bold tabular text-on-surface-dim">
                {formatMoney(remainingFundCents, trip.baseCurrency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.reserved_future')}</span>
              <span className="text-xs font-bold tabular" style={{ color: '#D4A843bb' }}>
                {formatMoney(fts.futureFloorCents, trip.baseCurrency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.protected_reserve')}</span>
              <span className="text-xs font-bold tabular text-on-surface-faint">
                {formatMoney(fts.protectedReserveCents, trip.baseCurrency)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* OCCASION COUNTERS */}
      {hasOccasionData && (
        <div className="mx-5 mt-4 grid grid-cols-3 gap-3">
          <OccasionCounter
            icon="local_bar"
            count={barCount}
            label={t('dashboard.occasion_bar')}
            iconBg="#C75B3918"
            iconColor="var(--primary)"
          />
          <OccasionCounter
            icon="shopping_cart"
            count={marketCount}
            label={t('dashboard.occasion_market')}
            iconBg="#6B8F7118"
            iconColor="var(--success)"
          />
          <OccasionCounter
            icon="restaurant"
            count={restaurantCount}
            label={t('dashboard.occasion_restaurant')}
            iconBg="#D4A84318"
            iconColor="var(--warning)"
          />
        </div>
      )}

      {/* PENDING EXPENSES */}
      {hasPendingExpenses && (
        <div
          className="mx-5 mt-4 p-4 rounded-2xl flex items-center gap-3"
          style={{ background: '#D4A84312', border: '1px solid #D4A84320' }}
        >
          <Icon name="group" className="text-warning" />
          <div className="flex-1">
            <p className="text-sm font-bold text-warning">
              {t('dashboard.pending_expenses', { count: pendingShared.length })}
            </p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#D4A843aa' }}>
              {t('dashboard.pending_impact', { amount: formatMoney(pendingImpactCents, trip.baseCurrency) })}
            </p>
          </div>
          <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
        </div>
      )}

      {/* PERSONAL SHOPPING */}
      {personalSummary && personalPool && (
        <div className="mx-5 mt-5 p-4 rounded-2xl bg-surface-container">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#C75B3918' }}
            >
              <Icon name="shopping_bag" size={18} className="text-primary" />
            </div>
            <p className="text-sm font-bold text-on-surface">{t('dashboard.personal_shopping')}</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[32px] font-extrabold tracking-tight leading-none tabular text-on-surface">
                {formatMoney(personalSummary.remainingCents, personalPool.currency)}
              </p>
              <p className="text-[11px] font-semibold mt-1 text-on-surface-dim">{t('dashboard.remaining')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-on-surface-faint">
                {t('dashboard.used_of', {
                  used: formatMoney(personalSummary.spentCents, personalPool.currency),
                  total: formatMoney(personalSummary.totalCents, personalPool.currency),
                })}
              </p>
              <div
                className="w-28 h-2 rounded-full overflow-hidden mt-1.5"
                style={{ background: 'var(--surface-container-high)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, personalSummary.percentUsed)}%`,
                    background: 'var(--primary)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECENT EXPENSES */}
      {recent.length > 0 && (
        <div className="mx-5 mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-on-surface">
              {t('dashboard.recent_expenses')}
            </p>
            <button
              onClick={() => navigate('/expenses')}
              className="text-xs text-primary btn-press font-bold"
            >
              {t('common.view_all')}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {recent.map((tx) => (
              <div key={tx.id} className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-on-surface font-semibold">{tx.description}</p>
                  <p className="text-xs text-on-surface-faint">
                    {tx.category ? t(`categories.${tx.category}` as never) : ''}
                  </p>
                </div>
                <p className="text-sm font-bold tabular text-on-surface">
                  {formatMoney(tx.amountCents, tx.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent.length === 0 && (
        <div className="mx-5 mt-5">
          <div className="bg-surface-container rounded-xl p-6 text-center">
            <Icon name="receipt_long" size={32} className="text-on-surface-mute mx-auto mb-2" />
            <p className="text-sm text-on-surface-dim">{t('dashboard.no_expenses')}</p>
            <p className="text-xs text-on-surface-faint mt-1">{t('dashboard.no_expenses_desc')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function OccasionCounter({
  icon,
  count,
  label,
  iconBg,
  iconColor,
}: {
  icon: string;
  count: number;
  label: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="p-3.5 rounded-2xl text-center bg-surface-container">
      <div
        className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-1.5"
        style={{ background: iconBg }}
      >
        <Icon name={icon} size={18} style={{ color: iconColor }} />
      </div>
      <p className="text-xl font-extrabold tabular text-on-surface">{count}</p>
      <p className="text-[10px] font-bold text-on-surface-dim">{label}</p>
    </div>
  );
}
