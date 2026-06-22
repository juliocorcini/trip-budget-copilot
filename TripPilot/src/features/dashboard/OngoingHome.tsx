import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import {
  formatMoney,
  fromCents,
  toCents,
  transactionBasePersonalCostCents,
} from '@/domain/money';
import { formatShortDate, localDateString } from '@/domain/dates';
import { getRecentTransactions, sumExpensesInMonth } from '@/domain/transactions';
import { monthlyCapStatus } from '@/domain/spaces/spaces';
import { getCategoryIcon } from '@/utils/category-icons';
import { splitMoneyDisplay } from './dashboard-format';
import type { DashboardModel } from './useDashboardModel';
import type { Trip } from '@/domain/types/trip';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-251: the continuous "Dia a dia" home. A space with no end date has no
 * countdown, no phases and no per-day allowance (spaceCapabilities gates those
 * off), so the home reasons per calendar MONTH.
 *
 * DEC-251 (os-budget): the monthly cap is OPTIONAL. With a cap, the headline is
 * what's left this month (cap − spent) plus a progress bar — the same
 * "remaining is the actionable number" idea as the trip's free-to-spend. With
 * no cap, the space just tallies the month-to-date total. The cap lives on the
 * space's pool and is editable inline; the spent total always comes straight
 * from the transactions (month-scoped), so it resets every month on its own.
 */
export function OngoingHome({
  model,
  trip,
  transactions,
  onSetMonthlyCap,
}: {
  model: DashboardModel;
  trip: Trip;
  transactions: Transaction[];
  onSetMonthlyCap: (cents: number) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currency = trip.baseCurrency;

  const month = localDateString(new Date()).slice(0, 7);
  const spentCents = sumExpensesInMonth(transactions, month);
  const capCents = model.primaryPool?.totalAmountCents ?? 0;
  const { hasCap, remainingCents, isOver, pct } = monthlyCapStatus(spentCents, capCents);

  // The headline mirrors the trip hero: with a cap, show what's LEFT; without
  // one, show what was SPENT. Over budget flips to the (negative) overage.
  const headlineCents = hasCap ? Math.abs(remainingCents) : spentCents;
  const display = splitMoneyDisplay(headlineCents, currency);

  const recent = getRecentTransactions(transactions, 8).filter((tx) => tx.type === 'expense');
  const monthLabel = new Date().toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const openEditor = () => {
    setDraft(hasCap ? String(fromCents(capCents)) : '');
    setEditing(true);
  };

  const saveCap = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSetMonthlyCap(toCents(parseFloat(draft.replace(',', '.')) || 0));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const headlineLabel = !hasCap
    ? t('ongoing.spent_this_month')
    : isOver
      ? t('ongoing.over_budget')
      : t('ongoing.remaining_this_month');

  return (
    <div className="flex flex-col gap-6 pt-8">
      <div className="bg-surface-container rounded-3xl p-8 text-center">
        <p className="text-[11px] tracking-[0.15em] uppercase font-bold text-on-surface-faint">
          {headlineLabel}
        </p>
        <p
          className={`mt-3 font-extrabold tabular leading-none ${isOver ? 'text-error' : 'text-on-surface'}`}
        >
          <span className="text-6xl">
            {isOver ? '-' : ''}
            {display.integer}
          </span>
          <span className="text-2xl">{display.decimal}</span>
        </p>

        {hasCap ? (
          <>
            <div className="mt-5 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-high)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: isOver ? 'var(--error)' : 'var(--primary)' }}
              />
            </div>
            <p className="mt-2 text-xs text-on-surface-dim">
              {t('ongoing.of_cap', {
                spent: formatMoney(spentCents, currency),
                cap: formatMoney(capCents, currency),
              })}
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-on-surface-dim capitalize">{monthLabel}</p>
        )}

        {editing ? (
          <div className="mt-5 flex flex-col gap-2">
            <div className="bg-surface-high rounded-xl p-3 flex items-center gap-2">
              <span className="text-xs text-on-surface-faint">{currency}</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('ongoing.cap_placeholder')}
                autoFocus
                className="bg-transparent text-sm text-on-surface outline-none w-full text-right tabular"
              />
            </div>
            <p className="text-[10px] text-on-surface-faint leading-snug">{t('ongoing.cap_hint')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2 rounded-lg bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={saveCap}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-primary text-on-surface text-xs font-semibold btn-press disabled:opacity-40"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={openEditor}
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary btn-press"
          >
            <Icon name={hasCap ? 'edit' : 'add'} size={14} className="text-primary" />
            {hasCap ? t('ongoing.edit_cap') : t('ongoing.set_cap')}
          </button>
        )}
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
