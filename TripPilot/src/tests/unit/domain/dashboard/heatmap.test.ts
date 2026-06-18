import { describe, it, expect } from 'vitest';
import { buildMonthHeatmap, shiftMonth } from '@/domain/dashboard';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Transaction } from '@/domain/types/transaction';

// DEC-131: month heatmap — intensity relative to the month's own peak day.

function mkTx(amountCents: number, dayIso: string, category = 'bar'): Transaction {
  const tx = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category,
    description: 'test',
  });
  return { ...tx, date: `${dayIso}T14:00:00.000Z` };
}

describe('buildMonthHeatmap', () => {
  const transactions = [
    mkTx(1000, '2026-06-01'),
    mkTx(4000, '2026-06-02'),
    mkTx(2000, '2026-06-10'),
  ];

  it('computes totals, the peak and the month total', () => {
    const heatmap = buildMonthHeatmap(transactions, '2026-06', '2026-06-15');

    expect(heatmap.days).toHaveLength(30);
    expect(heatmap.maxDayCents).toBe(4000);
    expect(heatmap.monthTotalCents).toBe(7000);
    expect(heatmap.days[0]!.totalCents).toBe(1000);
    expect(heatmap.days[1]!.totalCents).toBe(4000);
    expect(heatmap.days[9]!.totalCents).toBe(2000);
  });

  it('buckets intensity into quartiles of the peak day', () => {
    const heatmap = buildMonthHeatmap(transactions, '2026-06', '2026-06-15');

    expect(heatmap.days[0]!.intensity).toBe(1); // 25% of peak
    expect(heatmap.days[1]!.intensity).toBe(4); // the peak itself
    expect(heatmap.days[9]!.intensity).toBe(2); // 50% of peak
    expect(heatmap.days[4]!.intensity).toBe(0); // no spending
  });

  it('marks days after today as future', () => {
    const heatmap = buildMonthHeatmap(transactions, '2026-06', '2026-06-15');
    expect(heatmap.days[14]!.isFuture).toBe(false);
    expect(heatmap.days[15]!.isFuture).toBe(true);
  });

  it('computes the weekday offset of day 1', () => {
    // 2026-06-01 is a Monday.
    expect(buildMonthHeatmap([], '2026-06', '2026-06-15').firstWeekday).toBe(1);
  });

  it('handles empty months without dividing by zero', () => {
    const heatmap = buildMonthHeatmap([], '2026-06', '2026-06-15');
    expect(heatmap.maxDayCents).toBe(0);
    expect(heatmap.days.every((d) => d.intensity === 0)).toBe(true);
  });

  it('GATE 19: each day carries a per-category split that sums to its total', () => {
    const txs = [
      mkTx(6_000, '2026-06-02', 'market'),
      mkTx(1_000, '2026-06-02', 'bar'),
      mkTx(500, '2026-06-02', 'bar'),
    ];
    const heatmap = buildMonthHeatmap(txs, '2026-06', '2026-06-15');
    const day2 = heatmap.days[1]!; // 2026-06-02

    expect(day2.totalCents).toBe(7_500);
    expect(day2.byCategory.map((c) => c.category)).toEqual(['market', 'bar']);
    expect(day2.byCategory.reduce((acc, c) => acc + c.totalCents, 0)).toBe(day2.totalCents);
    // Days without spend stay empty (no needless work).
    expect(heatmap.days[0]!.byCategory).toEqual([]);
  });
});

describe('shiftMonth', () => {
  it('crosses year boundaries in both directions', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-06', 0)).toBe('2026-06');
  });
});
