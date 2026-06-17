import { formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import type { MonthHeatmap, HeatmapIntensity } from '@/domain/dashboard';
import { weekdayLetters } from './calendar-utils';

/** DEC-131: intensity steps over the terracotta primary (#C75B39). */
const INTENSITY_BG: Record<HeatmapIntensity, string> = {
  0: 'var(--highlight-subtle)',
  1: '#C75B3933',
  2: '#C75B3959',
  3: '#C75B3980',
  4: '#C75B39B3',
};

interface HeatmapGridProps {
  heatmap: MonthHeatmap;
  currency: string;
  todayIso: string;
  /** Wave B: highlight the day tapped in the phase-map sheet (Copilot omits it). */
  selectedDayIso?: string | null;
  onSelectDay: (dayIso: string) => void;
}

/**
 * DEC-131 / Wave B (F22): the month spending grid, extracted so both the Copilot
 * `HeatmapCard` (with month nav) and the dashboard phase-map sheet reuse the same
 * 7-column calendar. Tap a spending day to surface it.
 */
export function HeatmapGrid({
  heatmap,
  currency,
  todayIso,
  selectedDayIso = null,
  onSelectDay,
}: HeatmapGridProps) {
  const locale = getActiveIntlLocale();

  return (
    <div className="grid grid-cols-7 gap-1">
      {weekdayLetters(locale).map((letter, i) => (
        <p key={`wd-${i}`} className="text-center text-[9px] font-bold uppercase text-on-surface-faint">
          {letter}
        </p>
      ))}
      {Array.from({ length: heatmap.firstWeekday }, (_, i) => (
        <div key={`pad-${i}`} />
      ))}
      {heatmap.days.map((day) => {
        const isToday = day.dayIso === todayIso;
        const isSelected = day.dayIso === selectedDayIso;
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
              border: isSelected
                ? '1.5px solid var(--on-surface)'
                : isToday
                  ? '1.5px solid var(--primary)'
                  : '1px solid transparent',
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
  );
}
