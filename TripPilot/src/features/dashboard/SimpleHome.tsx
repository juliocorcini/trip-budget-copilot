import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { splitMoneyDisplay } from './dashboard-format';
import type { DashboardModel } from './useDashboardModel';
import type { Trip } from '@/domain/types/trip';

/**
 * E1 (M18): the simple-mode home — one big number ("free today") and one
 * action ("register"). Same math as the full dashboard (reuses the model),
 * just far less on screen.
 */
export function SimpleHome({ model, trip }: { model: DashboardModel; trip: Trip }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currency = trip.baseCurrency;

  const freeTodayCents = model.todayBudget?.freeTodayCents ?? null;
  const isOver = freeTodayCents !== null && freeTodayCents < 0;
  const display = freeTodayCents !== null ? splitMoneyDisplay(freeTodayCents, currency) : null;

  return (
    <div className="flex flex-col gap-6 pt-8">
      <div className="bg-surface-container rounded-3xl p-8 text-center">
        <p className="text-[11px] tracking-[0.15em] uppercase font-bold text-on-surface-faint">
          {t('dashboard.simple_free_today')}
        </p>
        {display ? (
          <p className={`mt-3 font-extrabold tabular leading-none ${isOver ? 'text-error' : 'text-on-surface'}`}>
            <span className="text-6xl">{isOver ? '-' : ''}{display.integer}</span>
            <span className="text-2xl">{display.decimal}</span>
          </p>
        ) : (
          <p className="mt-3 text-2xl font-bold text-on-surface">{t('dashboard.simple_no_budget')}</p>
        )}
        {isOver && (
          <p className="mt-3 text-xs font-semibold text-error">{t('dashboard.simple_over_today')}</p>
        )}
        {model.fts && (
          <p className="mt-2 text-xs text-on-surface-dim">
            {t('dashboard.simple_free_phase', {
              amount: formatMoney(model.fts.freeToSpendCents, currency),
            })}
          </p>
        )}
      </div>

      <button
        onClick={() => navigate('/quick-add')}
        className="w-full py-5 rounded-2xl bg-primary text-on-surface font-bold text-lg btn-press flex items-center justify-center gap-2"
      >
        <Icon name="add" size={24} className="text-on-surface" />
        {t('dashboard.simple_register')}
      </button>

      {/* Essential shortcut: jump back into a running outing if there is one. */}
      {model.activeSession && (
        <button
          onClick={() => navigate('/outings/active')}
          className="w-full py-3 rounded-xl bg-surface-container text-on-surface-dim font-semibold text-sm btn-press flex items-center justify-center gap-2"
        >
          <Icon name={model.sessionIcon} size={18} className="text-primary" />
          {t('dashboard.simple_active_outing')}
        </button>
      )}
    </div>
  );
}
