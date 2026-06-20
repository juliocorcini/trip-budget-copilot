import { describe, it, expect } from 'vitest';
import { buildTripWrapped, isTripEnded } from '@/domain/copilot';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Transaction } from '@/domain/types/transaction';

function mkTx(
  amountCents: number,
  opts: { category?: string | null; date?: string; isShared?: boolean } = {},
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
    exchangeRate: null,
  });
  return { ...tx, date: `${opts.date ?? '2026-06-10'}T12:00:00.000Z` };
}

describe('isTripEnded', () => {
  it('is true only when the end date is strictly in the past', () => {
    expect(isTripEnded('2026-06-10', '2026-06-18')).toBe(true);
    expect(isTripEnded('2026-06-18', '2026-06-10')).toBe(false);
    // The last day still counts as "on trip", not ended.
    expect(isTripEnded('2026-06-10', '2026-06-10')).toBe(false);
    expect(isTripEnded('', '2026-06-10')).toBe(false);
  });
});

describe('buildTripWrapped', () => {
  const base = { endDateIso: '2026-06-30', todayIso: '2026-06-18' };

  it('returns an all-null preview for a trip with no spend', () => {
    const w = buildTripWrapped({ transactions: [], ...base });
    expect(w.totalCents).toBe(0);
    expect(w.expenseCount).toBe(0);
    expect(w.activeDays).toBe(0);
    expect(w.biggestDay).toBeNull();
    expect(w.topCategory).toBeNull();
    expect(w.social).toBeNull();
    expect(w.streak).toBeNull();
    expect(w.peakHour).toBeNull();
    expect(w.ended).toBe(false); // 2026-06-30 is after 2026-06-18
  });

  it('assembles the headline + superlatives from real spend', () => {
    const txs = [
      mkTx(5000, { category: 'bar', date: '2026-06-10' }),
      mkTx(3000, { category: 'restaurant', date: '2026-06-10' }),
      mkTx(10000, { category: 'bar', date: '2026-06-11' }),
      mkTx(2000, { category: 'market', date: '2026-06-12' }),
    ];
    const w = buildTripWrapped({
      transactions: txs,
      endDateIso: '2026-06-12',
      todayIso: '2026-06-18',
    });
    expect(w.totalCents).toBe(20000);
    expect(w.expenseCount).toBe(4);
    expect(w.activeDays).toBe(3);
    // 06-10 = 8000, 06-11 = 10000, 06-12 = 2000 → biggest is 06-11.
    expect(w.biggestDay).toEqual({ dayIso: '2026-06-11', cents: 10000 });
    // bar = 5000 + 10000 = 15000 → 75% of 20000.
    expect(w.topCategory).toEqual({ category: 'bar', cents: 15000, percent: 75 });
    // No shared spend → social present but 0% shared (the UI hides it).
    expect(w.social).not.toBeNull();
    expect(w.social!.sharedCents).toBe(0);
    expect(w.social!.soloCents).toBe(20000);
    // All four expenses land in the same clock hour → one peak owning 100%.
    expect(w.peakHour).not.toBeNull();
    expect(w.peakHour!.hourCount).toBe(4);
    expect(w.peakHour!.sharePercent).toBe(100);
    expect(w.ended).toBe(true); // 2026-06-12 < 2026-06-18
  });

  it('computes the social split exactly', () => {
    const txs = [mkTx(6000, { isShared: false }), mkTx(4000, { isShared: true })];
    const w = buildTripWrapped({ transactions: txs, ...base });
    expect(w.social).not.toBeNull();
    expect(w.social!.sharedCents).toBe(4000);
    expect(w.social!.soloCents).toBe(6000);
    expect(w.social!.sharedPercent).toBe(40);
  });

  it('does not fabricate thin stats (1 expense → no peak hour, no streak)', () => {
    const w = buildTripWrapped({ transactions: [mkTx(5000, { category: 'bar' })], ...base });
    expect(w.totalCents).toBe(5000);
    expect(w.topCategory).toEqual({ category: 'bar', cents: 5000, percent: 100 });
    expect(w.biggestDay).toEqual({ dayIso: '2026-06-10', cents: 5000 });
    expect(w.peakHour).toBeNull(); // needs >= 3 expenses
    expect(w.streak).toBeNull(); // no daily target passed
  });

  it('includes the discipline streak only when a daily target is given', () => {
    const txs = [
      mkTx(1000, { date: '2026-06-10' }),
      mkTx(1000, { date: '2026-06-11' }),
      mkTx(1000, { date: '2026-06-12' }),
    ];
    expect(buildTripWrapped({ transactions: txs, ...base }).streak).toBeNull();
    const withTarget = buildTripWrapped({ transactions: txs, ...base, dailyTargetCents: 5000 });
    expect(withTarget.streak).not.toBeNull();
    expect(withTarget.streak!.longestStreak).toBe(3); // all 3 days <= 5000
  });

  it('ignores deleted and zero-cost rows', () => {
    const txs: Transaction[] = [
      mkTx(5000, { date: '2026-06-10' }),
      { ...mkTx(9999, { date: '2026-06-10' }), deletedAt: new Date().toISOString() },
    ];
    const w = buildTripWrapped({ transactions: txs, ...base });
    expect(w.totalCents).toBe(5000);
    expect(w.expenseCount).toBe(1);
    expect(w.activeDays).toBe(1);
  });
});
