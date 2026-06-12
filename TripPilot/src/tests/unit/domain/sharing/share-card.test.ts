import { describe, it, expect } from 'vitest';
import { buildShareCardStats } from '@/domain/sharing';
import { createExpenseTransaction } from '@/domain/transactions';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPool } from '@/domain/types/budget-pool';

// DEC-133: shareable trip summary card (local PNG export, no social surface).

function mkTx(amountCents: number, category: string): Transaction {
  return createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category,
    description: 'test',
  });
}

function mkPool(totalAmountCents: number): BudgetPool {
  return {
    ...createSyncMetadata(),
    tripId: 'trip-1',
    name: 'Pool',
    scope: 'linked_phases',
    totalAmountCents,
    currency: 'EUR',
    notes: null,
  };
}

describe('buildShareCardStats', () => {
  it('aggregates spent, budget and percent used', () => {
    const stats = buildShareCardStats({
      transactions: [mkTx(1000, 'bar'), mkTx(2000, 'bar'), mkTx(2500, 'food')],
      pools: [mkPool(10000), mkPool(20000)],
      dayNumber: 5,
      totalDays: 30,
    });

    expect(stats.totalSpentCents).toBe(5500);
    expect(stats.totalBudgetCents).toBe(30000);
    expect(stats.percentUsed).toBe(18); // round(5500/30000*100)
    expect(stats.dayNumber).toBe(5);
    expect(stats.totalDays).toBe(30);
    expect(stats.dayPercent).toBe(17); // round(5/30*100)
  });

  it('finds the top spending category', () => {
    const stats = buildShareCardStats({
      transactions: [mkTx(1000, 'bar'), mkTx(2000, 'bar'), mkTx(2500, 'food')],
      pools: [mkPool(30000)],
      dayNumber: 1,
      totalDays: 10,
    });
    expect(stats.topCategory).toEqual({ category: 'bar', totalCents: 3000 });
  });

  it('excludes deleted transactions from the top category', () => {
    const deleted = { ...mkTx(9000, 'taxi'), deletedAt: '2026-06-01T00:00:00.000Z' };
    const stats = buildShareCardStats({
      transactions: [deleted, mkTx(100, 'bar')],
      pools: [mkPool(30000)],
      dayNumber: 1,
      totalDays: 10,
    });
    expect(stats.topCategory!.category).toBe('bar');
    expect(stats.totalSpentCents).toBe(100);
  });

  it('returns null top category when nothing was spent', () => {
    const stats = buildShareCardStats({
      transactions: [],
      pools: [mkPool(30000)],
      dayNumber: 1,
      totalDays: 10,
    });
    expect(stats.topCategory).toBeNull();
    expect(stats.percentUsed).toBe(0);
  });

  it('clamps the day number into the trip range', () => {
    const before = buildShareCardStats({
      transactions: [],
      pools: [],
      dayNumber: -3,
      totalDays: 10,
    });
    expect(before.dayNumber).toBe(1);

    const after = buildShareCardStats({
      transactions: [],
      pools: [],
      dayNumber: 99,
      totalDays: 10,
    });
    expect(after.dayNumber).toBe(10);
    expect(after.dayPercent).toBe(100);
  });

  it('handles a zero budget without dividing by zero', () => {
    const stats = buildShareCardStats({
      transactions: [mkTx(1000, 'bar')],
      pools: [],
      dayNumber: 1,
      totalDays: 1,
    });
    expect(stats.percentUsed).toBe(0);
  });
});
