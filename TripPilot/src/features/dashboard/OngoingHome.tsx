import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { formatMoney, transactionBasePersonalCostCents } from '@/domain/money';
import { formatShortDate, localDateString } from '@/domain/dates';
import { getRecentTransactions, sumExpensesInMonth } from '@/domain/transactions';
import { getCategoryIcon } from '@/utils/category-icons';
import { splitMoneyDisplay } from './dashboard-format';
import type { DashboardModel } from './useDashboardModel';
import type { Trip } from '@/domain/types/trip';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-251: the continuous "Dia a dia" home. A space with no end date has no
 * countdown, no phases and no per-day allowance (spaceCapabilities gates those
 * off), so the home reasons per calendar MONTH: how much was spent this month,
 * plus the recent feed and the one action that matters — register. The optional
 * monthly cap is layered on next (os-budget); here the number is the plain
 * month-to-date total. Reuses the same money/transaction domain as the trip
 * dashboard, so the math is identical.
 */
export function OngoingHome({
  model,
  trip,
  transactions,
}: {
  model: DashboardModel;
  trip: Trip;
  transactions: Transaction[];
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currency = trip.baseCurrency;

  const month = localDateString(new Date()).slice(0, 7);
  const spentCents = sumExpensesInMonth(transactions, month);
  const display = splitMoneyDisplay(spentCents, currency);
  const recent = getRecentTransactions(transactions, 8).filter((tx) => tx.type === 'expense');

  const monthLabel = new Date().toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-6 pt-8">
      <div className="bg-surface-container rounded-3xl p-8 text-center">
        <p className="text-[11px] tracking-[0.15em] uppercase font-bold text-on-surface-faint">
          {t('ongoing.spent_this_month')}
        </p>
        <p className="mt-3 font-extrabold tabular leading-none text-on-surface">
          <span className="text-6xl">{display.integer}</span>
          <span className="text-2xl">{display.decimal}</span>
        </p>
        <p className="mt-3 text-xs text-on-surface-dim capitalize">{monthLabel}</p>
      </div>

      <button
        onClick={() => navigate('/quick-add')}
        className="w-full py-5 rounded-2xl bg-primary text-on-surface font-bold text-lg btn-press flex items-center justify-center gap-2"
      >
        <Icon name="add" size={24} className="text-on-surface" />
        {t('ongoing.register')}
      </button>

      {model.activeSession && (
        <button
          onClick={() => navigate('/outings/active')}
          className="w-full py-3 rounded-xl bg-surface-container text-on-surface-dim font-semibold text-sm btn-press flex items-center justify-center gap-2"
        >
          <Icon name={model.sessionIcon} size={18} className="text-primary" />
          {t('dashboard.simple_active_outing')}
        </button>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-faint">
            {t('ongoing.recent')}
          </h2>
          {recent.length > 0 && (
            <button
              onClick={() => navigate('/expenses')}
              className="text-[11px] font-semibold text-primary btn-press"
            >
              {t('ongoing.see_all')}
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-on-surface-dim py-8 text-center">{t('ongoing.empty')}</p>
        ) : (
          recent.map((tx) => (
            <button
              key={tx.id}
              onClick={() => navigate('/expenses')}
              className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-surface-container btn-press"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--surface-high)' }}
              >
                <Icon name={getCategoryIcon(tx.category)} size={18} className="text-on-surface-dim" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold text-on-surface truncate">
                  {tx.description || t(`categories.${tx.category ?? 'other'}` as never)}
                </span>
                <span className="text-[11px] text-on-surface-faint">{formatShortDate(tx.date)}</span>
              </div>
              <span className="text-sm font-bold text-on-surface tabular shrink-0">
                {formatMoney(transactionBasePersonalCostCents(tx), currency)}
              </span>
            </button>
          ))
        )}
      </section>
    </div>
  );
}
