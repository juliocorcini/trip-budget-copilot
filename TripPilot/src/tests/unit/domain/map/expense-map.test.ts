import { describe, it, expect } from 'vitest';
import { buildExpenseMapPoints } from '@/domain/map';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-416 (G11): the pure aggregator behind the "spends on the map" screen. It
 * must (1) fold every spend at the same place into one point with the right
 * count + base-currency total, (2) NEVER emit a point without real coordinates
 * (Â-PLACE-REAL), and (3) be deterministic (biggest spend first) so the map and
 * its list read the same on every render. No map/DOM — offline can never break it.
 */

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function mkTx(overrides: Partial<Transaction>): Transaction {
  return {
    ...meta,
    id: 'tx-1',
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents: 1000,
    personalCostCents: 1000,
    currency: 'EUR',
    baseCurrencyAmountCents: 1000,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'Spend',
    date: '2026-07-01T20:00:00.000Z',
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
  };
}

describe('buildExpenseMapPoints', () => {
  it('returns no points when nothing has coordinates', () => {
    const points = buildExpenseMapPoints([mkTx({ id: 'a' }), mkTx({ id: 'b' })]);
    expect(points).toEqual([]);
  });

  it('folds spends that share a placeId into ONE point with count + base total', () => {
    const points = buildExpenseMapPoints([
      mkTx({ id: 'a', placeId: 'bar-1', latitude: 38.7, longitude: -9.1, baseCurrencyAmountCents: 1200 }),
      mkTx({ id: 'b', placeId: 'bar-1', latitude: 38.7, longitude: -9.1, baseCurrencyAmountCents: 800 }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]!.count).toBe(2);
    expect(points[0]!.totalCents).toBe(2000);
    expect(points[0]!.txIds).toHaveLength(2);
  });

  it('sums the BASE-currency amount, not the foreign face value', () => {
    // A €-base trip: a spend of 5000 JPY that cost 3000 base cents must count as 3000.
    const points = buildExpenseMapPoints([
      mkTx({ id: 'jpy', placeId: 'shop', latitude: 35.6, longitude: 139.7, currency: 'JPY', amountCents: 500000, baseCurrencyAmountCents: 3000 }),
    ]);
    expect(points[0]!.totalCents).toBe(3000);
  });

  it('keeps distinct places apart and orders them by total spend, desc', () => {
    const points = buildExpenseMapPoints([
      mkTx({ id: 'cheap', placeId: 'p-cheap', latitude: 10, longitude: 10, baseCurrencyAmountCents: 500 }),
      mkTx({ id: 'pricey', placeId: 'p-pricey', latitude: 20, longitude: 20, baseCurrencyAmountCents: 9000 }),
      mkTx({ id: 'mid', placeId: 'p-mid', latitude: 30, longitude: 30, baseCurrencyAmountCents: 2500 }),
    ]);
    expect(points.map((p) => p.totalCents)).toEqual([9000, 2500, 500]);
    expect(points[0]!.lat).toBe(20);
  });

  it('orders a point\'s txIds newest-first for the tap → list sheet', () => {
    const points = buildExpenseMapPoints([
      mkTx({ id: 'older', placeId: 'venue', latitude: 1, longitude: 1, date: '2026-07-01T09:00:00.000Z' }),
      mkTx({ id: 'newer', placeId: 'venue', latitude: 1, longitude: 1, date: '2026-07-03T09:00:00.000Z' }),
      mkTx({ id: 'middle', placeId: 'venue', latitude: 1, longitude: 1, date: '2026-07-02T09:00:00.000Z' }),
    ]);
    expect(points[0]!.txIds).toEqual(['newer', 'middle', 'older']);
  });

  it('ignores non-expense, soft-deleted, and coordinate-less rows', () => {
    const points = buildExpenseMapPoints([
      mkTx({ id: 'transfer', type: 'transfer', placeId: 'x', latitude: 1, longitude: 1, baseCurrencyAmountCents: 5000 }),
      mkTx({ id: 'income', type: 'income', placeId: 'x', latitude: 1, longitude: 1, baseCurrencyAmountCents: 5000 }),
      mkTx({ id: 'deleted', placeId: 'x', latitude: 1, longitude: 1, deletedAt: '2026-07-02T00:00:00.000Z', baseCurrencyAmountCents: 5000 }),
      mkTx({ id: 'nocoords', baseCurrencyAmountCents: 5000 }),
      mkTx({ id: 'good', placeId: 'x', latitude: 1, longitude: 1, baseCurrencyAmountCents: 700 }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]!.txIds).toEqual(['good']);
    expect(points[0]!.totalCents).toBe(700);
  });

  it('prefers a user-confirmed label over an auto-geocoded one', () => {
    const points = buildExpenseMapPoints([
      mkTx({ id: 'a', placeId: 'v', latitude: 1, longitude: 1, placeLabel: 'Maybe Café', placeNameSource: 'auto' }),
      mkTx({ id: 'b', placeId: 'v', latitude: 1, longitude: 1, placeLabel: 'Café do Zé', placeNameSource: 'user' }),
    ]);
    expect(points[0]!.label).toBe('Café do Zé');
  });

  it('groups coordinate-only spends (no placeId) by exact coordinate', () => {
    const points = buildExpenseMapPoints([
      mkTx({ id: 'a', latitude: 41.1, longitude: -8.6, baseCurrencyAmountCents: 300 }),
      mkTx({ id: 'b', latitude: 41.1, longitude: -8.6, baseCurrencyAmountCents: 400 }),
      mkTx({ id: 'c', latitude: 41.2, longitude: -8.6, baseCurrencyAmountCents: 100 }),
    ]);
    expect(points).toHaveLength(2);
    const merged = points.find((p) => p.count === 2)!;
    expect(merged.totalCents).toBe(700);
  });
});
