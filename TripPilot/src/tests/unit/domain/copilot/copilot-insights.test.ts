import { describe, it, expect } from 'vitest';
import {
  buildCopilotVerdict,
  paceToleranceCents,
  summarizeByCategory,
  summarizeDailySpending,
  summarizeSocialVsSolo,
  comparePhasePace,
  summarizeForecastTrend,
  calculateRunway,
  summarizeWeekdayPattern,
  summarizeOutingEfficiency,
  summarizePaymentMix,
  summarizeHomeCurrencyTotal,
  summarizePeakHour,
  summarizeDisciplineStreak,
} from '@/domain/copilot';
import type { WalletType } from '@/domain/types/common';
import { buildMonthHeatmap } from '@/domain/dashboard';
import { createExpenseTransaction } from '@/domain/transactions';
import { createForecastSnapshot } from '@/domain/insights';
import type { PhaseBurndown } from '@/domain/dashboard';
import type { Transaction } from '@/domain/types/transaction';
import type { ForecastSnapshot } from '@/domain/types/forecast-snapshot';

function mkSnapshot(
  snapshotDate: string,
  projectedEndSpendCents: number,
  deleted = false,
): ForecastSnapshot {
  const snap = createForecastSnapshot({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    snapshotDate,
    totalBudgetCents: 150000,
    totalSpentCents: 0,
    freeToSpendCents: 0,
    avgDailySpendCents: 0,
    projectedEndSpendCents,
    daysOfData: 3,
  });
  return deleted ? { ...snap, deletedAt: new Date().toISOString() } : snap;
}

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

describe('summarizeForecastTrend', () => {
  it('reads a falling projection as "improving" with the delta and span', () => {
    // first 110000 → tolerance max(500, 3300) = 3300; latest 98000 → −12000.
    const trend = summarizeForecastTrend([
      mkSnapshot('2026-06-10', 110000),
      mkSnapshot('2026-06-12', 104000),
      mkSnapshot('2026-06-14', 98000),
    ]);
    expect(trend?.direction).toBe('improving');
    expect(trend?.deltaCents).toBe(-12000);
    expect(trend?.firstProjectedCents).toBe(110000);
    expect(trend?.latestProjectedCents).toBe(98000);
    expect(trend?.daysSpan).toBe(4);
    expect(trend?.snapshotCount).toBe(3);
  });

  it('reads a rising projection as "worsening"', () => {
    const trend = summarizeForecastTrend([
      mkSnapshot('2026-06-10', 90000),
      mkSnapshot('2026-06-13', 100000),
    ]);
    expect(trend?.direction).toBe('worsening');
    expect(trend?.deltaCents).toBe(10000);
  });

  it('self-censors when the change is inside tolerance (flat)', () => {
    // first 100000 → tolerance 3000; latest 101500 → +1500 is flat.
    expect(
      summarizeForecastTrend([mkSnapshot('2026-06-10', 100000), mkSnapshot('2026-06-14', 101500)]),
    ).toBeNull();
  });

  it('needs at least two non-deleted, positive snapshots', () => {
    expect(summarizeForecastTrend([mkSnapshot('2026-06-10', 100000)])).toBeNull();
    expect(
      summarizeForecastTrend([
        mkSnapshot('2026-06-10', 100000),
        mkSnapshot('2026-06-14', 80000, true), // deleted → ignored
      ]),
    ).toBeNull();
  });
});

describe('calculateRunway', () => {
  it('floors free ÷ daily pace and flags when it covers the phase', () => {
    // 60000 / 5000 = 12 days ≥ 8 left → covers.
    expect(calculateRunway(60000, 5000, 8)).toEqual({ days: 12, coversRemaining: true });
  });

  it('flags when the free budget runs out before the phase ends', () => {
    // 30000 / 5000 = 6 days < 10 left.
    expect(calculateRunway(30000, 5000, 10)).toEqual({ days: 6, coversRemaining: false });
  });

  it('floors partial days', () => {
    expect(calculateRunway(12000, 5000, 3)?.days).toBe(2); // 2.4 → 2
  });

  it('returns null without free budget, pace or days left', () => {
    expect(calculateRunway(0, 5000, 8)).toBeNull();
    expect(calculateRunway(60000, 0, 8)).toBeNull();
    expect(calculateRunway(60000, 5000, 0)).toBeNull();
  });
});

describe('summarizeWeekdayPattern', () => {
  it('averages per distinct day and compares weekend vs weekday', () => {
    // 06-10 Wed (2000+1000=3000) + 06-11 Thu (1000) → weekday avg 2000.
    // 06-13 Sat (5000) + 06-14 Sun (3000) → weekend avg 4000. ratio 2.0.
    const pattern = summarizeWeekdayPattern([
      mkTx(2000, { date: '2026-06-10' }),
      mkTx(1000, { date: '2026-06-10' }),
      mkTx(1000, { date: '2026-06-11' }),
      mkTx(5000, { date: '2026-06-13' }),
      mkTx(3000, { date: '2026-06-14' }),
    ]);
    expect(pattern?.weekdayAvgCents).toBe(2000);
    expect(pattern?.weekendAvgCents).toBe(4000);
    expect(pattern?.ratio).toBe(2);
    expect(pattern?.weekendIsPricier).toBe(true);
  });

  it('returns null until there is at least one weekend and one weekday', () => {
    expect(summarizeWeekdayPattern([mkTx(1000, { date: '2026-06-10' })])).toBeNull(); // weekday only
    expect(summarizeWeekdayPattern([mkTx(1000, { date: '2026-06-13' })])).toBeNull(); // weekend only
  });

  it('self-censors with fewer than two distinct days on a side (DEC-396)', () => {
    // weekday: 06-10 Wed + 06-11 Thu (2 days); weekend: only 06-13 Sat (1 day) → null.
    expect(
      summarizeWeekdayPattern([
        mkTx(1000, { date: '2026-06-10' }),
        mkTx(1000, { date: '2026-06-11' }),
        mkTx(1000, { date: '2026-06-13' }),
      ]),
    ).toBeNull();
  });

  it('self-censors when one purchase dominates the totals (DEC-396)', () => {
    // ≥2 distinct days per side, but 20000 of 23000 (≈87%) is one Saturday buy → null.
    expect(
      summarizeWeekdayPattern([
        mkTx(1000, { date: '2026-06-10' }), // Wed
        mkTx(1000, { date: '2026-06-11' }), // Thu
        mkTx(20000, { date: '2026-06-13' }), // Sat — dominant
        mkTx(1000, { date: '2026-06-14' }), // Sun
      ]),
    ).toBeNull();
  });
});

describe('summarizeOutingEfficiency', () => {
  it('counts within-target outings and the average saving', () => {
    // (5000−4000)=+1000 within; (6000−6500)=−500 over → avg 250, within 1/2.
    const eff = summarizeOutingEfficiency([
      { targetCents: 5000, totalCents: 4000 },
      { targetCents: 6000, totalCents: 6500 },
    ]);
    expect(eff).toEqual({ total: 2, withinTarget: 1, avgSavingCents: 250 });
  });

  it('treats exactly on target as within target', () => {
    const eff = summarizeOutingEfficiency([
      { targetCents: 5000, totalCents: 5000 },
      { targetCents: 5000, totalCents: 4000 },
    ]);
    expect(eff?.withinTarget).toBe(2);
    expect(eff?.avgSavingCents).toBe(500); // (0 + 1000) / 2
  });

  it('needs at least two outings to be a pattern', () => {
    expect(summarizeOutingEfficiency([{ targetCents: 5000, totalCents: 4000 }])).toBeNull();
    expect(summarizeOutingEfficiency([])).toBeNull();
  });
});

/* ─────────────── B10 — four new data-gated cross-cuts ─────────────── */

// A local-time datetime (no Z) so getHours()/localDayOf are deterministic
// regardless of the runner's timezone.
function mkExpenseAt(
  amountCents: number,
  localDateTime: string,
  walletId: string | null = null,
): Transaction {
  const tx = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'test',
  });
  return { ...tx, date: localDateTime };
}

describe('summarizePaymentMix', () => {
  const walletTypes = new Map<string, WalletType>([
    ['cash-1', 'cash'],
    ['card-1', 'credit_card'],
    ['debit-1', 'debit_card'],
    ['wise-1', 'digital'],
    ['other-1', 'other'],
  ]);

  it('splits classified spend into cash vs card and computes the cash share', () => {
    const mix = summarizePaymentMix(
      [
        mkExpenseAt(3000, '2026-06-10T12:00:00', 'cash-1'),
        mkExpenseAt(1000, '2026-06-10T13:00:00', 'cash-1'),
        mkExpenseAt(4000, '2026-06-10T14:00:00', 'card-1'),
        mkExpenseAt(2000, '2026-06-10T15:00:00', 'wise-1'),
      ],
      walletTypes,
    );
    // cash 4000, card 4000 + 2000 = 6000, classified 10000 → 40% cash.
    expect(mix).toEqual({
      cashCents: 4000,
      cardCents: 6000,
      untrackedCents: 0,
      classifiedCents: 10000,
      cashPercent: 40,
    });
  });

  it('counts `other`-typed and wallet-less spend as untracked, not in the ratio', () => {
    const mix = summarizePaymentMix(
      [
        mkExpenseAt(5000, '2026-06-10T12:00:00', 'cash-1'),
        mkExpenseAt(5000, '2026-06-10T13:00:00', 'card-1'),
        mkExpenseAt(2500, '2026-06-10T14:00:00', 'other-1'),
        mkExpenseAt(1500, '2026-06-10T15:00:00', null),
      ],
      walletTypes,
    );
    expect(mix?.untrackedCents).toBe(4000);
    expect(mix?.classifiedCents).toBe(10000);
    expect(mix?.cashPercent).toBe(50);
  });

  it('self-censors until there is both cash and card spend', () => {
    expect(
      summarizePaymentMix([mkExpenseAt(5000, '2026-06-10T12:00:00', 'cash-1')], walletTypes),
    ).toBeNull();
    expect(
      summarizePaymentMix([mkExpenseAt(5000, '2026-06-10T12:00:00', 'card-1')], walletTypes),
    ).toBeNull();
    expect(summarizePaymentMix([], walletTypes)).toBeNull();
  });

  it('ignores deleted and non-expense transactions', () => {
    const deleted = { ...mkExpenseAt(9999, '2026-06-10T12:00:00', 'cash-1'), deletedAt: '2026-06-11T00:00:00.000Z' };
    const transfer = { ...mkExpenseAt(9999, '2026-06-10T12:00:00', 'cash-1'), type: 'transfer' as const };
    const mix = summarizePaymentMix(
      [deleted, transfer, mkExpenseAt(1000, '2026-06-10T12:00:00', 'cash-1'), mkExpenseAt(1000, '2026-06-10T13:00:00', 'card-1')],
      walletTypes,
    );
    expect(mix?.classifiedCents).toBe(2000);
  });
});

describe('summarizeHomeCurrencyTotal', () => {
  it('sums personal spend in the base currency and counts the expenses', () => {
    const total = summarizeHomeCurrencyTotal([
      mkExpenseAt(2500, '2026-06-10T12:00:00'),
      mkExpenseAt(1500, '2026-06-11T12:00:00'),
      mkExpenseAt(6000, '2026-06-12T12:00:00'),
    ]);
    expect(total).toEqual({ totalCents: 10000, expenseCount: 3 });
  });

  it('ignores deleted and non-expense rows', () => {
    const total = summarizeHomeCurrencyTotal([
      mkExpenseAt(5000, '2026-06-10T12:00:00'),
      { ...mkExpenseAt(9999, '2026-06-10T12:00:00'), deletedAt: '2026-06-11T00:00:00.000Z' },
      { ...mkExpenseAt(9999, '2026-06-10T12:00:00'), type: 'transfer' as const },
    ]);
    expect(total).toEqual({ totalCents: 5000, expenseCount: 1 });
  });

  it('returns null when there is no spend', () => {
    expect(summarizeHomeCurrencyTotal([])).toBeNull();
  });
});

describe('summarizePeakHour', () => {
  it('finds the local hour with the most spend and its share', () => {
    // 20h: 5000 + 3000 = 8000; 13h: 2000; total 10000 → peak 20h, 80%.
    const peak = summarizePeakHour([
      mkExpenseAt(5000, '2026-06-10T20:00:00'),
      mkExpenseAt(3000, '2026-06-11T20:30:00'),
      mkExpenseAt(2000, '2026-06-12T13:00:00'),
    ]);
    expect(peak?.hour).toBe(20);
    expect(peak?.hourCents).toBe(8000);
    expect(peak?.hourCount).toBe(2);
    expect(peak?.sharePercent).toBe(80);
  });

  it('self-censors below a real sample (fewer than 3 expenses)', () => {
    expect(
      summarizePeakHour([
        mkExpenseAt(5000, '2026-06-10T20:00:00'),
        mkExpenseAt(3000, '2026-06-11T20:00:00'),
      ]),
    ).toBeNull();
  });

  it('ignores deleted and non-expense transactions', () => {
    const peak = summarizePeakHour([
      mkExpenseAt(1000, '2026-06-10T09:00:00'),
      mkExpenseAt(1000, '2026-06-11T09:00:00'),
      mkExpenseAt(1000, '2026-06-12T09:00:00'),
      { ...mkExpenseAt(99999, '2026-06-13T22:00:00'), deletedAt: '2026-06-14T00:00:00.000Z' },
      { ...mkExpenseAt(99999, '2026-06-13T22:00:00'), type: 'settlement' as const },
    ]);
    expect(peak?.hour).toBe(9);
  });

  it('self-censors below three distinct spending days (DEC-396)', () => {
    // 3 expenses but only 2 distinct days → not a time-of-day habit → null.
    expect(
      summarizePeakHour([
        mkExpenseAt(5000, '2026-06-10T20:00:00'),
        mkExpenseAt(3000, '2026-06-10T20:30:00'),
        mkExpenseAt(2000, '2026-06-11T13:00:00'),
      ]),
    ).toBeNull();
  });

  it('self-censors when one purchase dominates the spend (DEC-396)', () => {
    // 3 distinct days, but 20000 of 22000 (≈91%) is one buy → no honest peak → null.
    expect(
      summarizePeakHour([
        mkExpenseAt(20000, '2026-06-10T20:00:00'),
        mkExpenseAt(1000, '2026-06-11T13:00:00'),
        mkExpenseAt(1000, '2026-06-12T14:00:00'),
      ]),
    ).toBeNull();
  });
});

describe('summarizeDisciplineStreak', () => {
  // target 5000/day. Days: 10(4000 ok) 11(3000 ok) 12(7000 over) 13(2000 ok) 14(1000 ok)
  const days = [
    mkExpenseAt(4000, '2026-06-10T12:00:00'),
    mkExpenseAt(3000, '2026-06-11T12:00:00'),
    mkExpenseAt(7000, '2026-06-12T12:00:00'),
    mkExpenseAt(2000, '2026-06-13T12:00:00'),
    mkExpenseAt(1000, '2026-06-14T12:00:00'),
  ];

  it('counts the current and longest run of days within the daily target', () => {
    const streak = summarizeDisciplineStreak(days, 5000);
    // longest = 10–11 (2) and 13–14 (2) → 2; current (from 14 back) = 13,14 → 2.
    expect(streak).toEqual({ currentStreak: 2, longestStreak: 2, activeDays: 5, dailyTargetCents: 5000 });
  });

  it('treats spend exactly on target as disciplined', () => {
    const streak = summarizeDisciplineStreak(
      [
        mkExpenseAt(5000, '2026-06-10T12:00:00'),
        mkExpenseAt(5000, '2026-06-11T12:00:00'),
        mkExpenseAt(5000, '2026-06-12T12:00:00'),
      ],
      5000,
    );
    expect(streak?.currentStreak).toBe(3);
    expect(streak?.longestStreak).toBe(3);
  });

  it('breaks the current streak when the most recent day is over target', () => {
    const streak = summarizeDisciplineStreak(
      [
        mkExpenseAt(1000, '2026-06-10T12:00:00'),
        mkExpenseAt(1000, '2026-06-11T12:00:00'),
        mkExpenseAt(9000, '2026-06-12T12:00:00'),
      ],
      5000,
    );
    expect(streak?.currentStreak).toBe(0);
    expect(streak?.longestStreak).toBe(2);
  });

  it('returns null without a positive target, enough days, or a 2-day run', () => {
    expect(summarizeDisciplineStreak(days, 0)).toBeNull();
    expect(summarizeDisciplineStreak([mkExpenseAt(1000, '2026-06-10T12:00:00')], 5000)).toBeNull();
    // every active day over target → no run of 2 → null
    expect(
      summarizeDisciplineStreak(
        [mkExpenseAt(9000, '2026-06-10T12:00:00'), mkExpenseAt(9000, '2026-06-11T12:00:00')],
        5000,
      ),
    ).toBeNull();
  });
});
