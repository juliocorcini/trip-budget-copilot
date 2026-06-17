import { describe, it, expect } from 'vitest';
import {
  createPlannedPurchase,
  isPlannedPurchaseOpen,
  plannedPurchaseSpentCents,
  plannedPurchaseReservedRemainingCents,
  calculatePlannedPurchaseReserves,
  plannedPurchaseProgress,
  linkTransactionToPlannedPurchase,
  compatiblePlannedPurchasesForExpense,
} from '@/domain/planning/planned-purchases';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { Transaction } from '@/domain/types/transaction';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null as string | null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

function mkPurchase(overrides: Partial<PlannedPurchase> = {}): PlannedPurchase {
  return {
    ...baseMeta,
    id: 'pp-1',
    tripId: 'trip-1',
    budgetPoolId: 'pool-1',
    name: 'Skincare creams',
    category: 'shopping',
    estimatedCostCents: 15000,
    reservedCents: 15000,
    status: 'planned',
    linkedTransactionIds: [],
    store: null,
    targetDate: null,
    notes: null,
    phaseId: null,
    ...overrides,
  };
}

const mkTx = (id: string, personalCostCents: number): Transaction => ({
  ...baseMeta,
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: null,
  sessionId: null,
  type: 'expense',
  amountCents: personalCostCents,
  personalCostCents,
  currency: 'EUR',
  baseCurrencyAmountCents: personalCostCents,
  exchangeRate: null,
  category: 'shopping',
  subcategoryId: null,
  placeLabel: null,
  latitude: null,
  longitude: null,
  placeId: null,
  description: 'creams',
  date: '2026-01-02T00:00:00.000Z',
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
});

describe('createPlannedPurchase (DEC-175)', () => {
  it('defaults the reserve to the estimate when reservedCents is omitted', () => {
    const pp = createPlannedPurchase({
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      name: 'New jacket',
      category: 'shopping',
      estimatedCostCents: 12000,
    });
    expect(pp.reservedCents).toBe(12000);
    expect(pp.status).toBe('planned');
    expect(pp.linkedTransactionIds).toEqual([]);
    expect(pp.store).toBeNull();
    expect(pp.targetDate).toBeNull();
    expect(pp.phaseId).toBeNull();
  });

  it('keeps a null reserve when asked to track without reserving', () => {
    const pp = createPlannedPurchase({
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      name: 'Maybe shoes',
      category: 'shopping',
      estimatedCostCents: 8000,
      reservedCents: null,
    });
    expect(pp.reservedCents).toBeNull();
  });

  it('respects an explicit reserve below the estimate', () => {
    const pp = createPlannedPurchase({
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      name: 'Souvenirs',
      category: 'shopping',
      estimatedCostCents: 10000,
      reservedCents: 6000,
    });
    expect(pp.reservedCents).toBe(6000);
  });
});

describe('isPlannedPurchaseOpen (DEC-175)', () => {
  it('is open only when planned and not deleted', () => {
    expect(isPlannedPurchaseOpen(mkPurchase())).toBe(true);
    expect(isPlannedPurchaseOpen(mkPurchase({ status: 'bought' }))).toBe(false);
    expect(isPlannedPurchaseOpen(mkPurchase({ status: 'cancelled' }))).toBe(false);
    expect(
      isPlannedPurchaseOpen(mkPurchase({ deletedAt: '2026-01-05T00:00:00.000Z' })),
    ).toBe(false);
  });
});

describe('plannedPurchaseSpentCents (DEC-175)', () => {
  it('is zero with no linked transactions', () => {
    expect(plannedPurchaseSpentCents(mkPurchase(), [mkTx('t1', 5000)])).toBe(0);
  });

  it('sums the base personal cost of linked, non-deleted transactions', () => {
    const pp = mkPurchase({ linkedTransactionIds: ['t1', 't2'] });
    const txs = [mkTx('t1', 5000), mkTx('t2', 3200), mkTx('t3', 9999)];
    // only t1 + t2 are linked → 8200
    expect(plannedPurchaseSpentCents(pp, txs)).toBe(8200);
  });

  it('ignores deleted linked transactions', () => {
    const pp = mkPurchase({ linkedTransactionIds: ['t1', 't2'] });
    const txs = [mkTx('t1', 5000), { ...mkTx('t2', 3200), deletedAt: '2026-01-09T00:00:00.000Z' }];
    expect(plannedPurchaseSpentCents(pp, txs)).toBe(5000);
  });
});

describe('plannedPurchaseReservedRemainingCents (DEC-175 — the FTS term)', () => {
  it('shrinks the reserve by the real linked spend (no double counting)', () => {
    const pp = mkPurchase({ reservedCents: 15000, linkedTransactionIds: ['t1'] });
    // reserve 15000 - spent 5000 = 10000 still earmarked
    expect(plannedPurchaseReservedRemainingCents(pp, [mkTx('t1', 5000)])).toBe(10000);
  });

  it('never goes negative when real spend exceeds the reserve', () => {
    const pp = mkPurchase({ reservedCents: 15000, linkedTransactionIds: ['t1'] });
    expect(plannedPurchaseReservedRemainingCents(pp, [mkTx('t1', 20000)])).toBe(0);
  });

  it('reserves nothing for a track-only purchase (reservedCents null)', () => {
    const pp = mkPurchase({ reservedCents: null });
    expect(plannedPurchaseReservedRemainingCents(pp, [])).toBe(0);
  });

  it('reserves nothing once bought or cancelled', () => {
    expect(plannedPurchaseReservedRemainingCents(mkPurchase({ status: 'bought' }), [])).toBe(0);
    expect(plannedPurchaseReservedRemainingCents(mkPurchase({ status: 'cancelled' }), [])).toBe(0);
  });
});

describe('calculatePlannedPurchaseReserves (DEC-175 — pool roll-up)', () => {
  it('sums the remaining reserve of open purchases on the pool', () => {
    const a = mkPurchase({ id: 'a', reservedCents: 10000, linkedTransactionIds: ['t1'] });
    const b = mkPurchase({ id: 'b', reservedCents: 5000 });
    // a: 10000 - 3000 = 7000 ; b: 5000 - 0 = 5000 → 12000
    const total = calculatePlannedPurchaseReserves([a, b], [mkTx('t1', 3000)], 'pool-1');
    expect(total).toBe(12000);
  });

  it('ignores purchases charged to other pools', () => {
    const here = mkPurchase({ id: 'a', reservedCents: 10000 });
    const elsewhere = mkPurchase({ id: 'b', reservedCents: 9999, budgetPoolId: 'pool-2' });
    expect(calculatePlannedPurchaseReserves([here, elsewhere], [], 'pool-1')).toBe(10000);
  });

  it('ignores bought and cancelled purchases', () => {
    const open = mkPurchase({ id: 'a', reservedCents: 4000 });
    const bought = mkPurchase({ id: 'b', reservedCents: 8000, status: 'bought' });
    const cancelled = mkPurchase({ id: 'c', reservedCents: 8000, status: 'cancelled' });
    expect(calculatePlannedPurchaseReserves([open, bought, cancelled], [], 'pool-1')).toBe(4000);
  });
});

describe('plannedPurchaseProgress (DEC-175 — list UI)', () => {
  it('reports the percent of the estimate already spent', () => {
    const pp = mkPurchase({ estimatedCostCents: 10000, linkedTransactionIds: ['t1'] });
    const progress = plannedPurchaseProgress(pp, [mkTx('t1', 2500)]);
    expect(progress.spentCents).toBe(2500);
    expect(progress.remainingReserveCents).toBe(12500); // reserve 15000 - 2500
    expect(progress.percent).toBe(25);
  });

  it('clamps the percent at 100 when spend exceeds the estimate', () => {
    const pp = mkPurchase({ estimatedCostCents: 10000, linkedTransactionIds: ['t1'] });
    expect(plannedPurchaseProgress(pp, [mkTx('t1', 18000)]).percent).toBe(100);
  });

  it('is 0% with a zero estimate and no spend, 100% once anything is spent', () => {
    const zero = mkPurchase({ estimatedCostCents: 0, reservedCents: 0 });
    expect(plannedPurchaseProgress(zero, []).percent).toBe(0);
    const zeroSpent = mkPurchase({ estimatedCostCents: 0, reservedCents: 0, linkedTransactionIds: ['t1'] });
    expect(plannedPurchaseProgress(zeroSpent, [mkTx('t1', 500)]).percent).toBe(100);
  });
});

describe('linkTransactionToPlannedPurchase (DEC-175)', () => {
  it('appends the transaction id and is idempotent', () => {
    const pp = mkPurchase({ reservedCents: 15000 });
    const once = linkTransactionToPlannedPurchase(pp, 't1', [mkTx('t1', 1000)]);
    expect(once.linkedTransactionIds).toEqual(['t1']);
    const twice = linkTransactionToPlannedPurchase(once, 't1', [mkTx('t1', 1000)]);
    expect(twice.linkedTransactionIds).toEqual(['t1']);
  });

  it('auto-closes a reserved purchase once the reserve is fully consumed', () => {
    const pp = mkPurchase({ reservedCents: 5000 });
    const next = linkTransactionToPlannedPurchase(pp, 't1', [mkTx('t1', 5000)]);
    expect(next.status).toBe('bought');
  });

  it('keeps a reserved purchase open while reserve remains', () => {
    const pp = mkPurchase({ reservedCents: 15000 });
    const next = linkTransactionToPlannedPurchase(pp, 't1', [mkTx('t1', 5000)]);
    expect(next.status).toBe('planned');
  });

  it('never auto-closes a track-only purchase across multiple stores (skincare case)', () => {
    // reservedCents null → collect spend from pharmacy, Primor, Druni; closes only on explicit "bought"
    let pp = mkPurchase({ reservedCents: null });
    const txs = [mkTx('t1', 4000), mkTx('t2', 3500), mkTx('t3', 2000)];
    pp = linkTransactionToPlannedPurchase(pp, 't1', txs);
    pp = linkTransactionToPlannedPurchase(pp, 't2', txs);
    pp = linkTransactionToPlannedPurchase(pp, 't3', txs);
    expect(pp.status).toBe('planned');
    expect(pp.linkedTransactionIds).toEqual(['t1', 't2', 't3']);
  });
});

describe('compatiblePlannedPurchasesForExpense (D-IMP-03 — link from the expense side)', () => {
  it('offers an open, same-fund purchase that has not linked this expense yet', () => {
    const tx = mkTx('t1', 3000);
    const here = mkPurchase({ id: 'a' });
    const result = compatiblePlannedPurchasesForExpense(tx, [here]);
    expect(result.map((p) => p.id)).toEqual(['a']);
  });

  it('excludes purchases in a different fund', () => {
    const tx = mkTx('t1', 3000); // pool-1
    const elsewhere = mkPurchase({ id: 'b', budgetPoolId: 'pool-2' });
    expect(compatiblePlannedPurchasesForExpense(tx, [elsewhere])).toEqual([]);
  });

  it('excludes bought, cancelled and deleted purchases (not open)', () => {
    const tx = mkTx('t1', 3000);
    const bought = mkPurchase({ id: 'a', status: 'bought' });
    const cancelled = mkPurchase({ id: 'b', status: 'cancelled' });
    const deleted = mkPurchase({ id: 'c', deletedAt: '2026-01-03T00:00:00.000Z' });
    expect(compatiblePlannedPurchasesForExpense(tx, [bought, cancelled, deleted])).toEqual([]);
  });

  it('excludes a purchase that already links this exact expense (no double-link)', () => {
    const tx = mkTx('t1', 3000);
    const already = mkPurchase({ id: 'a', linkedTransactionIds: ['t1'] });
    const other = mkPurchase({ id: 'b', linkedTransactionIds: ['t9'] });
    expect(compatiblePlannedPurchasesForExpense(tx, [already, other]).map((p) => p.id)).toEqual(['b']);
  });

  it('never offers a planned purchase for an income row', () => {
    const income = { ...mkTx('t1', 3000), type: 'income' as const };
    expect(compatiblePlannedPurchasesForExpense(income, [mkPurchase()])).toEqual([]);
  });
});
