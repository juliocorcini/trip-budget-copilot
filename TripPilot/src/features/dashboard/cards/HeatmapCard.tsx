import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import type { MonthHeatmap, HeatmapIntensity } from '@/domain/dashboard';

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

/** DEC-131: intensity steps over the terracotta primary (#C75B39). */
const INTENSITY_BG: Record<HeatmapIntensity, string> = {
  0: 'var(--highlight-subtle)',
  1: '#C75B3933',
  2: '#C75B3959',
  3: '#C75B3980',
  4: '#C75B39B3',
};

/** Sunday-first narrow weekday letters in the active language. */
function weekdayLetters(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  // 2023-01-01 was a Sunday; +i walks Sun..Sat.
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(2023, 0, 1 + i, 12)),
  );
}

function monthLabel(monthIso: string, locale: string): string {
  const [year, month] = monthIso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year!, month! - 1, 1, 12),
  );
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

      <div className="grid grid-cols-7 gap-1 mt-3">
        {weekdayLetters(locale).map((letter, i) => (
          <p
            key={`wd-${i}`}
            className="text-center text-[9px] font-bold uppercase text-on-surface-faint"
          >
            {letter}
          </p>
        ))}
        {Array.from({ length: heatmap.firstWeekday }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {heatmap.days.map((day) => {
          const isToday = day.dayIso === todayIso;
          const tappable = day.totalCents > 0;
          return (
            <button
              key={day.dayIso}
              onClick={tappable ? () => onSelectDay(day.dayIso) : undefined}
              disabled={!tappable}
              className={`aspect-square rounded-md flex items-center justify-center ${
                tappable ? 'btn-press' : ''
              } ${day.isFuture ? 'opacity-30' : ''}`}
              style={{
                background: INTENSITY_BG[day.intensity],
                border: isToday ? '1.5px solid var(--primary)' : '1px solid transparent',
              }}
              aria-label={`${day.dayIso}: ${formatMoney(day.totalCents, currency)}`}
            >
              <span
                className={`text-[10px] tabular ${
                  day.intensity >= 1 ? 'font-bold text-on-surface' : 'font-medium text-on-surface-faint'
                }`}
              >
                {day.dayOfMonth}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs font-semibold text-on-surface-dim mt-3">
        {t('dashboard.heatmap_total', {
          amount: formatMoney(heatmap.monthTotalCents, currency),
        })}
      </p>
    </div>
  );
}
