import { useMemo } from 'react';
import { formatMoney, formatMoneyCompact } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import type { PhaseAllowanceDay, PhaseAllowanceMap } from '@/domain/phases';
import { weekdayLetters, monthLabel } from './calendar-utils';

/** Sage-green intensity ramp (theme-aware tokens) — mirrors the heatmap steps. */
const AVAIL_BG: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'var(--highlight-subtle)',
  1: 'var(--avail-1)',
  2: 'var(--avail-2)',
  3: 'var(--avail-3)',
  4: 'var(--avail-4)',
};

function intensityFor(cents: number, maxCents: number): 0 | 1 | 2 | 3 | 4 {
  if (cents <= 0 || maxCents <= 0) return 0;
  const bucket = Math.ceil((cents / maxCents) * 4);
  return Math.min(4, Math.max(1, bucket)) as 0 | 1 | 2 | 3 | 4;
}

interface MonthBlock {
  monthIso: string;
  firstWeekday: number;
  daysInMonth: number;
  byDom: Map<number, PhaseAllowanceDay>;
}

/** Groups the remaining phase days into month grids (usually one, two at most). */
function groupByMonth(days: PhaseAllowanceDay[]): MonthBlock[] {
  const blocks = new Map<string, MonthBlock>();
  for (const day of days) {
    const monthIso = day.dateIso.slice(0, 7);
    let block = blocks.get(monthIso);
    if (!block) {
      const [year, month] = monthIso.split('-').map(Number);
      block = {
        monthIso,
        firstWeekday: new Date(year!, month! - 1, 1, 12).getDay(),
        daysInMonth: new Date(year!, month!, 0).getDate(),
        byDom: new Map(),
      };
      blocks.set(monthIso, block);
    }
    block.byDom.set(Number(day.dateIso.slice(8, 10)), day);
  }
  return [...blocks.values()];
}

interface AvailableCalendarProps {
  map: PhaseAllowanceMap;
  currency: string;
  selectedDayIso: string | null;
  onSelectDay: (dayIso: string) => void;
}

/**
 * F4 + F22: the "available per day" map as a calendar (like the Copilot heatmap),
 * each day shaded by its total (free + reserved). Tap a day to drill into the
 * breakdown. Days before today / outside the phase render dimmed and inert.
 */
export function AvailableCalendar({ map, currency, selectedDayIso, onSelectDay }: AvailableCalendarProps) {
  const locale = getActiveIntlLocale();
  const months = useMemo(() => groupByMonth(map.days), [map.days]);

  return (
    <div className="flex flex-col gap-3">
      {months.map((block) => (
        <div key={block.monthIso}>
          {months.length > 1 && (
            <p className="text-[10px] font-bold uppercase text-on-surface-faint mb-1 capitalize">
              {monthLabel(block.monthIso, locale)}
            </p>
          )}
          <div className="grid grid-cols-7 gap-1">
            {weekdayLetters(locale).map((letter, i) => (
              <p
                key={`wd-${i}`}
                className="text-center text-[9px] font-bold uppercase text-on-surface-faint"
              >
                {letter}
              </p>
            ))}
            {Array.from({ length: block.firstWeekday }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: block.daysInMonth }, (_, i) => {
              const dom = i + 1;
              const day = block.byDom.get(dom);
              if (!day) {
                return (
                  <div key={dom} className="aspect-square rounded-md flex items-center justify-center">
                    <span className="text-[10px] text-on-surface-faint opacity-40">{dom}</span>
                  </div>
                );
              }
              const intensity = intensityFor(day.dayTotalCents, map.maxDayTotalCents);
              const isSelected = day.dateIso === selectedDayIso;
              return (
                <button
                  key={dom}
                  onClick={() => onSelectDay(day.dateIso)}
                  className="aspect-square rounded-md flex items-center justify-center btn-press relative"
                  style={{
                    background: AVAIL_BG[intensity],
                    border: isSelected
                      ? '1.5px solid var(--on-surface)'
                      : day.isToday
                        ? '1.5px solid var(--primary)'
                        : '1px solid transparent',
                  }}
                  aria-label={`${day.dateIso}: ${formatMoney(day.dayTotalCents, currency)}`}
                >
                  {/* D-IMP-01: day number on top, the day's € total compact below
                      so the value reads at a glance (no tap needed). */}
                  <span className="flex flex-col items-center justify-center leading-none">
                    <span
                      className={`text-[8px] tabular ${
                        intensity >= 1 ? 'font-semibold text-on-surface' : 'text-on-surface-faint'
                      }`}
                    >
                      {dom}
                    </span>
                    {day.dayTotalCents > 0 && (
                      <span
                        className={`text-[9px] tabular leading-none mt-px ${
                          intensity >= 1 ? 'font-bold text-on-surface' : 'font-medium text-on-surface-faint'
                        }`}
                      >
                        {formatMoneyCompact(day.dayTotalCents, locale, currency)}
                      </span>
                    )}
                  </span>
                  {day.planItems.length > 0 && (
                    <span
                      className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full"
                      style={{ background: 'var(--primary)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
