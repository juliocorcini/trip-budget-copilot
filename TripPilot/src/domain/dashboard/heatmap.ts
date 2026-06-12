import type { Transaction } from '@/domain/types/transaction';
import { calculateSpentOnDate } from '@/domain/transactions';

/**
 * DEC-131: month heatmap of daily personal spending. Trip-wide (all pools):
 * the question it answers is "how was my spending BEHAVIOR", not pool
 * accounting. Intensity buckets are relative to the month's own peak day.
 */

export type HeatmapIntensity = 0 | 1 | 2 | 3 | 4;

export interface HeatmapDay {
  dayIso: string;
  dayOfMonth: number;
  totalCents: number;
  intensity: HeatmapIntensity;
  isFuture: boolean;
}

export interface MonthHeatmap {
  /** YYYY-MM. */
  monthIso: string;
  days: HeatmapDay[];
  /** Weekday of day 1 — 0 (Sun) … 6 (Sat) — for the grid offset. */
  firstWeekday: number;
  monthTotalCents: number;
  maxDayCents: number;
}

export function shiftMonth(monthIso: string, delta: number): string {
  const [year, month] = monthIso.split('-').map(Number);
  const date = new Date(year!, (month! - 1) + delta, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function intensityFor(totalCents: number, maxDayCents: number): HeatmapIntensity {
  if (totalCents <= 0 || maxDayCents <= 0) return 0;
  const bucket = Math.ceil((totalCents / maxDayCents) * 4);
  return Math.min(4, Math.max(1, bucket)) as HeatmapIntensity;
}

export function buildMonthHeatmap(
  transactions: Transaction[],
  monthIso: string,
  todayIso: string,
): MonthHeatmap {
  const [year, month] = monthIso.split('-').map(Number);
  const daysInMonth = new Date(year!, month!, 0).getDate();
  const firstWeekday = new Date(year!, month! - 1, 1, 12).getDay();

  const totals: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayIso = `${monthIso}-${String(day).padStart(2, '0')}`;
    totals.push(calculateSpentOnDate(transactions, dayIso));
  }
  const maxDayCents = Math.max(0, ...totals);

  const days: HeatmapDay[] = totals.map((totalCents, i) => {
    const dayIso = `${monthIso}-${String(i + 1).padStart(2, '0')}`;
    return {
      dayIso,
      dayOfMonth: i + 1,
      totalCents,
      intensity: intensityFor(totalCents, maxDayCents),
      isFuture: dayIso > todayIso,
    };
  });

  return {
    monthIso,
    days,
    firstWeekday,
    monthTotalCents: totals.reduce((sum, v) => sum + v, 0),
    maxDayCents,
  };
}
