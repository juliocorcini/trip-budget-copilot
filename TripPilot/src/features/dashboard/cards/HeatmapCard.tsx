import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import type { MonthHeatmap } from '@/domain/dashboard';
import { HeatmapGrid } from './HeatmapGrid';
import { monthLabel } from './calendar-utils';

interface HeatmapCardProps {
  heatmap: MonthHeatmap;
  currency: string;
  todayIso: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (dayIso: string) => void;
}

/**
 * DEC-131: month heatmap — one glance shows which days burned money.
 * Tap a spending day to open its expense list in a sheet.
 */
export function HeatmapCard({
  heatmap,
  currency,
  todayIso,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSelectDay,
}: HeatmapCardProps) {
  const { t } = useTranslation();
  const locale = getActiveIntlLocale();

  return (
    <div className="mt-4 p-4 rounded-2xl bg-surface-container">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
          {t('dashboard.heatmap_title')}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            disabled={!canPrev}
            className="btn-press p-1 disabled:opacity-30"
            aria-label={t('dashboard.heatmap_prev_month')}
          >
            <Icon name="chevron_left" size={16} className="text-on-surface-dim" />
          </button>
          <p className="text-xs font-bold text-on-surface capitalize min-w-[110px] text-center">
            {monthLabel(heatmap.monthIso, locale)}
          </p>
          <button
            onClick={onNext}
            disabled={!canNext}
            className="btn-press p-1 disabled:opacity-30"
            aria-label={t('dashboard.heatmap_next_month')}
          >
            <Icon name="chevron_right" size={16} className="text-on-surface-dim" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <HeatmapGrid
          heatmap={heatmap}
          currency={currency}
          todayIso={todayIso}
          onSelectDay={onSelectDay}
        />
      </div>

      <p className="text-xs font-semibold text-on-surface-dim mt-3">
        {t('dashboard.heatmap_total', {
          amount: formatMoney(heatmap.monthTotalCents, currency),
        })}
      </p>
    </div>
  );
}
