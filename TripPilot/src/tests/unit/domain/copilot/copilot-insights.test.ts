import { describe, it, expect } from 'vitest';
import {
  buildCopilotVerdict,
  paceToleranceCents,
  summarizeByCategory,
  summarizeDailySpending,
  summarizeSocialVsSolo,
  comparePhasePace,
} from '@/domain/copilot';
import { buildMonthHeatmap } from '@/domain/dashboard';
import { createExpenseTransaction } from '@/domain/transactions';
import type { PhaseBurndown } from '@/domain/dashboard';
import type { Transaction } from '@/domain/types/transaction';

function mkBurndown(overrides: Partial<PhaseBurndown>): PhaseBurndown {
  return {
    points: [],
    budgetCents: 150000,
    spentToDateCents: 0,
    idealToDateCents: 0,
    deltaCents: 0,
    abovePace: false,
    todayIndex: 0,
    ...overrides,
  };
}

function mkTx(
  amountCents: number,
  opts: { category?: string | null; date?: string; isShared?: boolean; exchangeRate?: number } = {},
): Transaction {
  const tx = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: opts.category === undefined ? 'bar' : (opts.category as string),
    description: 'test',
    isShared: opts.isShared ?? false,
    exchangeRate: opts.exchangeRate ?? null,
  });
  return { ...tx, date: `${opts.date ?? '2026-06-10'}T12:00:00.000Z` };
}

describe('paceToleranceCents', () => {
  it('is 5% of the ideal, floored at 500 cents', () => {
    expect(paceToleranceCents(0)).toBe(500); // floor
    expect(paceToleranceCents(5000)).toBe(500); // 5% = 250 → floored to 500
    expect(paceToleranceCents(40000)).toBe(2000); // 5% of 400 = 20.00
  });
});

describe('buildCopilotVerdict', () => {
  it('returns null without a burn-down', () => {
    expect(buildCopilotVerdict(null)).toBeNull();
  });

  it('reads under-pace as "ahead"', () => {
    // ideal 67200 → tolerance 3360; delta -6700 is comfortably under.
    const v = buildCopilotVerdict(
      mkBurndown({ idealToDateCents: 67200, spentToDateCents: 60500, deltaCents: -6700 }),
    );
    expect(v?.status).toBe('ahead');
    expect(v?.deltaCents).toBe(-6700);
  });

  it('reads over-pace as "behind"', () => {
    const v = buildCopilotVerdict(
      mkBurndown({ idealToDateCents: 50000, spentToDateCents: 60000, deltaCents: 10000 }),
    );
    expect(v?.status).toBe('behind');
  });

  it('treats a small delta inside the tolerance band as "on track"', () => {
    // ideal 50000 → tolerance 2500; delta +1500 stays on track.
    const v = buildCopilotVerdict(
      mkBurndown({ idealToDateCents: 50000, spentToDateCents: 51500, deltaCents: 1500 }),
    );
    expect(v?.status).toBe('on_track');
  });
});

describe('summarizeByCategory', () => {
  it('sums base personal cost per category and sorts high→low', () => {
    const result = summarizeByCategory([
      mkTx(2100, { category: 'restaurant' }),
      mkTx(1300, { category: 'bar' }),
      mkTx(900, { category: 'bar' }),
      mkTx(1000, { category: 'transport' }),
    ]);
    expect(result).toEqual([
      { category: 'bar', cents: 2200 },
      { category: 'restaurant', cents: 2100 },
      { category: 'transport', cents: 1000 },
    ]);
  });

  it('converts foreign expenses with their frozen rate', () => {
    // 1000 minor units at rate 2 → 2000 base cents.
    const result = summarizeByCategory([mkTx(1000, { category: 'bar', exchangeRate: 2 })]);
    expect(result).toEqual([{ category: 'bar', cents: 2000 }]);
  });

  it('ignores deleted, non-expense and uncategorized rows', () => {
    const deleted = { ...mkTx(5000, { category: 'bar' }), deletedAt: new Date().toISOString() };
    const transfer = { ...mkTx(5000, { category: 'bar' }), type: 'transfer' as const };
    const uncategorized = mkTx(5000, { category: null });
    expect(summarizeByCategory([deleted, transfer, uncategorized])).toEqual([]);
  });
});

describe('summarizeDailySpending', () => {
  it('derives max day, active days and average per active day', () => {
    const heatmap = buildMonthHeatmap(
      [
        mkTx(1000, { date: '2026-06-01' }),
        mkTx(4000, { date: '2026-06-02' }),
        mkTx(2000, { date: '2026-06-10' }),
      ],
      '2026-06',
      '2026-06-15',
    );
    const summary = summarizeDailySpending(heatmap);
    expect(summary.maxDayCents).toBe(4000);
    expect(summary.monthTotalCents).toBe(7000);
    expect(summary.activeDays).toBe(3);
    expect(summary.avgPerActiveDayCents).toBe(2333); // 7000 / 3
  });

  it('does not count future days and never divides by zero', () => {
    const summary = summarizeDailySpending(buildMonthHeatmap([], '2026-06', '2026-06-15'));
    expect(summary.activeDays).toBe(0);
    expect(summary.avgPerActiveDayCents).toBe(0);
  });
});

describe('summarizeSocialVsSolo', () => {
  it('splits shared vs solo spend and computes the shared percent', () => {
    const result = summarizeSocialVsSolo([
      mkTx(3000, { isShared: true }),
      mkTx(1000, { isShared: false }),
    ]);
    expect(result.sharedCents).toBe(3000);
    expect(result.soloCents).toBe(1000);
    expect(result.totalCents).toBe(4000);
    expect(result.sharedPercent).toBe(75);
  });

  it('returns zeros with no expenses', () => {
    expect(summarizeSocialVsSolo([])).toEqual({
      sharedCents: 0,
      soloCents: 0,
      totalCents: 0,
      sharedPercent: 0,
    });
  });
});

describe('comparePhasePace', () => {
  it('compares the daily pace of two phases', () => {
    // current 200/day vs previous 100/day → +100%.
    const result = comparePhasePace(800, 4, 400, 4);
    expect(result).toEqual({
      currentPerDayCents: 200,
      previousPerDayCents: 100,
      deltaPercent: 100,
    });
  });

  it('reads a slower current phase as a negative delta', () => {
    // current 50/day vs previous 100/day → -50%.
    const result = comparePhasePace(250, 5, 500, 5);
    expect(result?.deltaPercent).toBe(-50);
  });

  it('returns null until both phases have real spend and days', () => {
    expect(comparePhasePace(0, 4, 400, 4)).toBeNull();
    expect(comparePhasePace(800, 0, 400, 4)).toBeNull();
    expect(comparePhasePace(800, 4, 0, 4)).toBeNull();
  });
});
