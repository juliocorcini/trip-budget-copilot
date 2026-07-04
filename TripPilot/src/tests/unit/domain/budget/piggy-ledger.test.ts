import { describe, it, expect } from 'vitest';
import {
  buildPiggyLedger,
  piggySettledBalanceCents,
  linearDailyIdealCents,
  buildRhythmDailyIdeals,
  buildPiggySpendByDay,
  type PiggyDaySpend,
} from '@/domain/budget/piggy-ledger';
import { calculatePoolSpent } from '@/domain/budget';
import type { Transaction } from '@/domain/types/transaction';

/**
 * FB-08 / DEC-279 (council C13 + C14) — Model B "buffer" ledger.
 *
 * The math sub-gate is locked by these invariant + "dip-and-recover" tests
 * BEFORE any UI is built on top of it (DEC-280 protocol, plan §4.1 / Gate 2).
 */

/** End-clamped Model A, for the path-dependence contrast in the recover case. */
function endClampedBalance(dailyIdealCents: number, spend: number[]): number {
  const totalIdeal = dailyIdealCents * spend.length;
  const totalSpent = spend.reduce((a, b) => a + b, 0);
  return Math.max(0, totalIdeal - totalSpent);
}

/** Build a contiguous spend series from a plain cents array (dates are synthetic). */
function days(spend: number[]): PiggyDaySpend[] {
  return spend.map((spentCents, i) => ({
    dateIso: `2026-06-${String(i + 1).padStart(2, '0')}`,
    spentCents,
  }));
}

describe('linearDailyIdealCents', () => {
  it('is phaseBudget / totalDays, rounded to integer cents', () => {
    expect(linearDailyIdealCents(100_000, 10)).toBe(10_000);
    expect(linearDailyIdealCents(100_000, 3)).toBe(33_333); // 33333.33 → 33333
  });

  it('returns 0 for ongoing / no-date phases or a non-positive budget (cofrinho hidden)', () => {
    expect(linearDailyIdealCents(100_000, 0)).toBe(0);
    expect(linearDailyIdealCents(100_000, -5)).toBe(0);
    expect(linearDailyIdealCents(0, 10)).toBe(0);
    expect(linearDailyIdealCents(-100, 10)).toBe(0);
  });
});

describe('buildRhythmDailyIdeals (DEC-393 · parte 2, G3 — rhythm-aware daily ideal)', () => {
  it('distributes the budget by weight: a peak day gets a larger ideal than a common day', () => {
    // 4 days, two of them peak (1.5) and two common (1.0) → total weight 5.0.
    const ideals = buildRhythmDailyIdeals(50_000, [
      { dateIso: '2026-06-01', weight: 1.0 },
      { dateIso: '2026-06-02', weight: 1.5 },
      { dateIso: '2026-06-03', weight: 1.0 },
      { dateIso: '2026-06-04', weight: 1.5 },
    ]);
    // 50_000 × 1.0 / 5.0 = 10_000 (common); × 1.5 / 5.0 = 15_000 (peak).
    expect(ideals.get('2026-06-01')).toBe(10_000);
    expect(ideals.get('2026-06-02')).toBe(15_000);
    expect(ideals.get('2026-06-02')!).toBeGreaterThan(ideals.get('2026-06-01')!);
  });

  it('Σ ideals === budget EXACTLY (the rounding remainder rides the last weighted day) — C14', () => {
    // A budget that does not divide evenly by the weights.
    const budget = 100_000;
    const ideals = buildRhythmDailyIdeals(budget, [
      { dateIso: '2026-06-01', weight: 0.8 },
      { dateIso: '2026-06-02', weight: 1.5 },
      { dateIso: '2026-06-03', weight: 0.6 },
    ]);
    const sum = [...ideals.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(budget);
  });

  it('excludes zero-weight days (an event-reserve day would carry weight 0 → no ideal entry)', () => {
    const ideals = buildRhythmDailyIdeals(30_000, [
      { dateIso: '2026-06-01', weight: 1.0 },
      { dateIso: '2026-06-02', weight: 0 }, // excluded
      { dateIso: '2026-06-03', weight: 1.0 },
    ]);
    expect(ideals.has('2026-06-02')).toBe(false);
    expect([...ideals.values()].reduce((a, b) => a + b, 0)).toBe(30_000);
  });

  it('returns an empty map for a non-positive budget or zero total weight', () => {
    expect(buildRhythmDailyIdeals(0, [{ dateIso: '2026-06-01', weight: 1 }]).size).toBe(0);
    expect(buildRhythmDailyIdeals(-10, [{ dateIso: '2026-06-01', weight: 1 }]).size).toBe(0);
    expect(buildRhythmDailyIdeals(10_000, [{ dateIso: '2026-06-01', weight: 0 }]).size).toBe(0);
  });
});

describe('buildPiggyLedger — per-day rhythm ideal (DEC-393, replay unchanged)', () => {
  it('applies each day its own ideal and still reconciles (balance == Σ deltas)', () => {
    // Peak day ideal 15_000, common day ideal 10_000; spend 12_000 each day.
    const idealByDayCents = new Map<string, number>([
      ['2026-06-01', 10_000], // common: spend 12_000 → withdraws 2_000 (empty → uncovered)
      ['2026-06-02', 15_000], // peak: spend 12_000 → deposits 3_000
    ]);
    const ledger = buildPiggyLedger({
      dailyIdealCents: 0,
      idealByDayCents,
      spendByDay: days([12_000, 12_000]),
    });
    expect(ledger.entries[0]!.idealCents).toBe(10_000);
    expect(ledger.entries[1]!.idealCents).toBe(15_000);
    // Day 1: max(0, 0 + 10_000 − 12_000) = 0 (2_000 uncovered). Day 2: 0 + 15_000 − 12_000 = 3_000.
    expect(ledger.entries.map((e) => e.balanceCents)).toEqual([0, 3_000]);
    expect(ledger.balanceCents).toBe(ledger.totalDepositedCents - ledger.totalWithdrawnCents);
    expect(ledger.entries[0]!.uncoveredCents).toBe(2_000);
  });

  it('falls back to the flat dailyIdealCents for a day missing from the map', () => {
    const idealByDayCents = new Map<string, number>([['2026-06-01', 20_000]]);
    const ledger = buildPiggyLedger({
      dailyIdealCents: 5_000, // fallback for 2026-06-02
      idealByDayCents,
      spendByDay: days([0, 0]),
    });
    expect(ledger.entries[0]!.idealCents).toBe(20_000);
    expect(ledger.entries[1]!.idealCents).toBe(5_000);
    expect(ledger.balanceCents).toBe(25_000);
  });
});

describe('buildPiggyLedger — deposits (spending under the daily ideal)', () => {
  it('accumulates the under-spend day by day', () => {
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days([6_000, 7_000, 5_000]) });

    expect(ledger.entries.map((e) => e.balanceCents)).toEqual([4_000, 7_000, 12_000]);
    expect(ledger.entries.map((e) => e.deltaCents)).toEqual([4_000, 3_000, 5_000]);
    expect(ledger.entries.every((e) => e.kind === 'deposit')).toBe(true);
    expect(ledger.balanceCents).toBe(12_000);
    expect(ledger.totalDepositedCents).toBe(12_000);
    expect(ledger.totalWithdrawnCents).toBe(0);
    expect(ledger.totalUncoveredCents).toBe(0);
  });

  it('a zero-spend day credits the FULL daily ideal (check-in "não vou gastar")', () => {
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days([0]) });
    expect(ledger.entries[0]).toMatchObject({ kind: 'deposit', deltaCents: 10_000, balanceCents: 10_000 });
  });
});

describe('buildPiggyLedger — withdrawals (the C13 buffer absorbs an overspend)', () => {
  it('a single overspend fully covered by prior savings withdraws, balance not floored', () => {
    // day1 saves 10k; day2 overspends by 5k → piggy covers it entirely.
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days([0, 15_000]) });

    expect(ledger.entries[1]).toMatchObject({
      kind: 'withdrawal',
      deltaCents: -5_000,
      balanceCents: 5_000,
      uncoveredCents: 0,
    });
    expect(ledger.balanceCents).toBe(5_000);
    expect(ledger.totalWithdrawnCents).toBe(5_000);
  });

  it('partial coverage: the piggy empties and the remainder is uncovered', () => {
    // day1 saves 3k; day2 overspends by 8k → 3k from piggy, 5k uncovered.
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days([7_000, 18_000]) });

    expect(ledger.entries[1]).toMatchObject({
      kind: 'withdrawal',
      deltaCents: -3_000,
      balanceCents: 0,
      uncoveredCents: 5_000,
    });
    expect(ledger.balanceCents).toBe(0);
    expect(ledger.totalWithdrawnCents).toBe(3_000);
    expect(ledger.totalUncoveredCents).toBe(5_000);
  });

  it('an overspend with an EMPTY piggy cannot go negative (flat, fully uncovered)', () => {
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days([15_000]) });
    expect(ledger.entries[0]).toMatchObject({
      kind: 'flat',
      deltaCents: 0,
      balanceCents: 0,
      uncoveredCents: 5_000,
    });
  });

  it('depleted then continued overspend stays at 0 and accumulates uncovered', () => {
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days([5_000, 30_000, 30_000]) });
    expect(ledger.entries.map((e) => e.balanceCents)).toEqual([5_000, 0, 0]);
    expect(ledger.entries.map((e) => e.uncoveredCents)).toEqual([0, 15_000, 20_000]);
    expect(ledger.balanceCents).toBe(0);
    expect(ledger.totalUncoveredCents).toBe(35_000);
  });
});

describe('buildPiggyLedger — path-dependence (Model B ≠ end-clamped Model A)', () => {
  it('"dip-and-recover": a bad day with an empty piggy is NOT silently repaid by a later great day', () => {
    // dia1 overspends 5k on an empty piggy (lost), dia2 saves 8k.
    const spend = [15_000, 2_000];
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days(spend) });

    // Model B: floor on day 1 → only day 2's +8k survives.
    expect(ledger.balanceCents).toBe(8_000);
    // Model A (end-clamped) would net it to 3k — proving they genuinely differ.
    expect(endClampedBalance(10_000, spend)).toBe(3_000);
    expect(ledger.balanceCents).not.toBe(endClampedBalance(10_000, spend));
  });
});

describe('buildPiggyLedger — replay is date-ordered regardless of input order', () => {
  it('sorts by dateIso, so shuffled input yields the same balance', () => {
    const ordered = days([15_000, 2_000]); // dip-and-recover → 8_000
    const shuffled = [...ordered].reverse();
    const a = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: ordered });
    const b = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: shuffled });

    expect(b.entries.map((e) => e.dateIso)).toEqual(a.entries.map((e) => e.dateIso));
    expect(b.balanceCents).toBe(8_000);
  });
});

describe('buildPiggyLedger — edges', () => {
  it('empty input → empty ledger, zero everywhere', () => {
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: [] });
    expect(ledger.entries).toEqual([]);
    expect(ledger.balanceCents).toBe(0);
    expect(ledger.totalDepositedCents).toBe(0);
    expect(ledger.totalWithdrawnCents).toBe(0);
  });

  it('ongoing phase (dailyIdeal 0) never accrues a balance', () => {
    const ledger = buildPiggyLedger({ dailyIdealCents: 0, spendByDay: days([0, 5_000, 0]) });
    expect(ledger.balanceCents).toBe(0);
    expect(ledger.entries.every((e) => e.balanceCents === 0)).toBe(true);
  });

  it('clamps negative/ fractional spend defensively', () => {
    const ledger = buildPiggyLedger({
      dailyIdealCents: 10_000,
      spendByDay: [{ dateIso: '2026-06-01', spentCents: -200 }],
    });
    // negative spend is treated as 0 → full deposit, never an inflated credit.
    expect(ledger.entries[0]!.deltaCents).toBe(10_000);
  });
});

describe('buildPiggyLedger — INVARIANT: no cent doubled or lost (C14 non-negotiable)', () => {
  it('balance == last entry balance == Σ deltas == deposits − withdrawals', () => {
    const spend = [3_000, 8_000, 0, 12_000, 1_000, 5_000, 4_000];
    const ledger = buildPiggyLedger({ dailyIdealCents: 5_000, spendByDay: days(spend) });

    const sumDeltas = ledger.entries.reduce((s, e) => s + e.deltaCents, 0);
    const lastBalance = ledger.entries[ledger.entries.length - 1]!.balanceCents;
    expect(ledger.balanceCents).toBe(sumDeltas);
    expect(ledger.balanceCents).toBe(lastBalance);
    expect(ledger.balanceCents).toBe(ledger.totalDepositedCents - ledger.totalWithdrawnCents);
  });

  it('every running balance equals max(0, prev + ideal − spent) and is never negative', () => {
    const spend = [3_000, 8_000, 0, 12_000, 1_000, 5_000, 4_000];
    const ideal = 5_000;
    const ledger = buildPiggyLedger({ dailyIdealCents: ideal, spendByDay: days(spend) });

    let prev = 0;
    for (const entry of ledger.entries) {
      const expected = Math.max(0, prev + ideal - entry.spentCents);
      expect(entry.balanceCents).toBe(expected);
      expect(entry.balanceCents).toBeGreaterThanOrEqual(0);
      prev = entry.balanceCents;
    }
  });
});

describe('buildPiggyLedger — DEC-465 manual withdrawals (resgate)', () => {
  it('a resgate leaves the MORNING balance; the day still settles its own flow', () => {
    // day1 saves 10k. day2: resgate 4k (from the 10k), zero spend → +10k flow.
    const ledger = buildPiggyLedger({
      dailyIdealCents: 10_000,
      spendByDay: days([0, 0]),
      withdrawalByDay: new Map([['2026-06-02', 4_000]]),
    });
    expect(ledger.entries[1]).toMatchObject({
      manualCents: 4_000,
      deltaCents: 10_000, // flow only — the resgate rides manualCents
      balanceCents: 16_000, // 10k − 4k + 10k
      kind: 'deposit',
    });
    expect(ledger.balanceCents).toBe(16_000);
    expect(ledger.totalManualWithdrawnCents).toBe(4_000);
    // C14 with resgates: deposits − flow-withdrawals − manual == balance.
    expect(
      ledger.totalDepositedCents - ledger.totalWithdrawnCents - ledger.totalManualWithdrawnCents,
    ).toBe(ledger.balanceCents);
  });

  it('a resgate can never overdraw — capped at the opening balance', () => {
    // day1 saves 2k; day2 requests 50k → only 2k honored, then overspend hits
    // an empty piggy (uncovered, floor at 0).
    const ledger = buildPiggyLedger({
      dailyIdealCents: 10_000,
      spendByDay: days([8_000, 25_000]),
      withdrawalByDay: new Map([['2026-06-02', 50_000]]),
    });
    expect(ledger.entries[1]).toMatchObject({
      manualCents: 2_000,
      balanceCents: 0,
      uncoveredCents: 15_000, // 0 + 10k − 25k
    });
    expect(ledger.totalManualWithdrawnCents).toBe(2_000);
  });

  it('absent withdrawal map → byte-identical to the pre-DEC-465 ledger', () => {
    const spend = days([3_000, 12_000, 0]);
    const a = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: spend });
    const b = buildPiggyLedger({
      dailyIdealCents: 10_000,
      spendByDay: spend,
      withdrawalByDay: new Map(),
    });
    expect(b.entries).toEqual(a.entries);
    expect(b.balanceCents).toBe(a.balanceCents);
  });
});

describe('piggySettledBalanceCents — DEC-464 (INV-2: today is provisional)', () => {
  it("backs out today's provisional deposit (the €37→€14 weekend bug)", () => {
    // Yesterday closed at 5k; today (no spend yet) provisionally deposits 10k.
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days([5_000, 0]) });
    expect(ledger.balanceCents).toBe(15_000); // raw ledger includes today
    expect(piggySettledBalanceCents(ledger, '2026-06-02')).toBe(5_000); // settled does not
  });

  it("keeps today's manual resgate (an action, not a simulation)", () => {
    // Closed balance 10k; today the user takes 4k back → settled reads 6k.
    const ledger = buildPiggyLedger({
      dailyIdealCents: 10_000,
      spendByDay: days([0, 0]),
      withdrawalByDay: new Map([['2026-06-02', 4_000]]),
    });
    expect(piggySettledBalanceCents(ledger, '2026-06-02')).toBe(6_000);
  });

  it('no entry for today (day not open yet) → the full closed balance', () => {
    const ledger = buildPiggyLedger({ dailyIdealCents: 10_000, spendByDay: days([5_000]) });
    expect(piggySettledBalanceCents(ledger, '2026-06-09')).toBe(5_000);
  });
});

const txMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    ...txMeta,
    id: `tx-${Math.random()}`,
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents: 1000,
    personalCostCents: null,
    currency: 'EUR',
    baseCurrencyAmountCents: 1000,
    exchangeRate: null,
    category: 'food',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'test',
    date: '2026-06-01T12:00:00.000Z',
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
    ...overrides,
  } as Transaction;
}

describe('buildPiggySpendByDay — pool spend decomposed per calendar day', () => {
  it('CRITICAL invariant: Σ daily spend === calculatePoolSpent (never diverges from the totals)', () => {
    // A realistic mix: two same-day rows, a personalCost (split), a foreign rate,
    // an adjustment, plus noise that pool-spent also ignores (income / deleted).
    const txs = [
      makeTx({ date: '2026-06-01T09:00:00.000Z', amountCents: 1200 }),
      makeTx({ date: '2026-06-01T21:30:00.000Z', amountCents: 800 }),
      makeTx({ date: '2026-06-02T12:00:00.000Z', personalCostCents: 500, amountCents: 2000 }),
      makeTx({ date: '2026-06-03T12:00:00.000Z', amountCents: 1000, exchangeRate: 6, baseCurrencyAmountCents: 6000 }),
      makeTx({ date: '2026-06-03T15:00:00.000Z', type: 'adjustment', amountCents: 300 }),
      makeTx({ date: '2026-06-04T12:00:00.000Z', type: 'income', amountCents: 9999 }),
      makeTx({ date: '2026-06-04T12:00:00.000Z', deletedAt: '2026-06-05T00:00:00.000Z', amountCents: 7777 }),
    ];

    const spendByDay = buildPiggySpendByDay({
      transactions: txs,
      startDateIso: '2026-06-01',
      daysElapsed: 4,
    });
    const sum = spendByDay.reduce((s, d) => s + d.spentCents, 0);

    // transactionBasePersonalCostCents: 1200 + 800 + 500 + 1000*6 + 300 = 8800.
    expect(sum).toBe(8800);
    expect(sum).toBe(calculatePoolSpent(txs));
  });

  it('zero-fills every elapsed day so idle days still accrue the ideal as a deposit', () => {
    const txs = [makeTx({ date: '2026-06-02T12:00:00.000Z', amountCents: 1000 })];
    const spendByDay = buildPiggySpendByDay({
      transactions: txs,
      startDateIso: '2026-06-01',
      daysElapsed: 3,
    });
    // 3 elapsed days present, the two with no spend zeroed.
    expect(spendByDay).toHaveLength(3);
    const byDay = Object.fromEntries(spendByDay.map((d) => [d.dateIso, d.spentCents]));
    expect(byDay).toEqual({ '2026-06-01': 0, '2026-06-02': 1000, '2026-06-03': 0 });

    // Fed to the ledger with ideal 1000: deposit, flat, deposit → balance 2000.
    const ledger = buildPiggyLedger({ dailyIdealCents: 1000, spendByDay });
    expect(ledger.balanceCents).toBe(2000);
  });

  it('never drops a row dated OUTSIDE the elapsed window (keeps the Σ invariant)', () => {
    // A row dated after `daysElapsed` must still appear, or the balance would
    // diverge from calculatePoolSpent. Its day is emitted even if not enumerated.
    const txs = [
      makeTx({ date: '2026-06-01T12:00:00.000Z', amountCents: 1000 }),
      makeTx({ date: '2026-06-09T12:00:00.000Z', amountCents: 500 }),
    ];
    const spendByDay = buildPiggySpendByDay({
      transactions: txs,
      startDateIso: '2026-06-01',
      daysElapsed: 2,
    });
    const sum = spendByDay.reduce((s, d) => s + d.spentCents, 0);
    expect(sum).toBe(1500);
    expect(sum).toBe(calculatePoolSpent(txs));
    expect(spendByDay.some((d) => d.dateIso === '2026-06-09')).toBe(true);
  });

  it('returns an empty series for no transactions and zero elapsed days', () => {
    expect(buildPiggySpendByDay({ transactions: [], startDateIso: '2026-06-01', daysElapsed: 0 })).toEqual([]);
  });
});
