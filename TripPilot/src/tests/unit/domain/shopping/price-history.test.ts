import { describe, it, expect } from 'vitest';
import { buildPriceHistory, normalizeItemName } from '@/domain/shopping';
import type { Transaction } from '@/domain/types/transaction';

/**
 * GATE 6 (D07) — per-item price history. PURE math + name-matching, verified with
 * concrete cents so the "how does this compare to before?" verdict stays honest.
 */

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null as string | null,
  revision: 1,
  sourceDeviceId: 'test',
};

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    ...meta,
    id: `tx-${Math.random()}`,
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
    description: 'Café',
    date: '2026-06-10T12:00:00.000Z',
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

describe('normalizeItemName', () => {
  it('is accent-insensitive, lowercased and whitespace-collapsed', () => {
    expect(normalizeItemName('Café')).toBe('cafe');
    expect(normalizeItemName('  CAFÉ   LATTE  ')).toBe('cafe latte');
    expect(normalizeItemName('cafe latte')).toBe('cafe latte');
    expect(normalizeItemName('PÃO de Queijo')).toBe('pao de queijo');
  });

  it('treats accent/case/spacing variants of the same item as equal', () => {
    expect(normalizeItemName('Café')).toBe(normalizeItemName('cafe  '));
    expect(normalizeItemName('CAFÉ  LATTE')).toBe(normalizeItemName('café latte'));
  });
});

describe('buildPriceHistory — guards', () => {
  it('returns null when the item has fewer than two purchases', () => {
    const current = makeTx({ id: 'a', description: 'Café', baseCurrencyAmountCents: 300 });
    expect(buildPriceHistory({ current, transactions: [current] })).toBeNull();
  });

  it('returns null when the focused transaction is not an expense', () => {
    const current = makeTx({ id: 'a', type: 'income', description: 'Café', baseCurrencyAmountCents: 300 });
    const other = makeTx({ id: 'b', description: 'Café', baseCurrencyAmountCents: 400 });
    expect(buildPriceHistory({ current, transactions: [current, other] })).toBeNull();
  });

  it('returns null when the description is empty / whitespace only', () => {
    const current = makeTx({ id: 'a', description: '   ', baseCurrencyAmountCents: 300 });
    const other = makeTx({ id: 'b', description: '   ', baseCurrencyAmountCents: 400 });
    expect(buildPriceHistory({ current, transactions: [current, other] })).toBeNull();
  });
});

describe('buildPriceHistory — math (verified cents)', () => {
  it('computes min/max/avg and the signed delta vs average in base currency', () => {
    const a = makeTx({ id: 'a', description: 'Café', baseCurrencyAmountCents: 300, date: '2026-06-01' });
    const b = makeTx({ id: 'b', description: 'cafe', baseCurrencyAmountCents: 500, date: '2026-06-05' });
    const c = makeTx({ id: 'c', description: 'CAFÉ', baseCurrencyAmountCents: 400, date: '2026-06-03' });
    // current = the priciest purchase (500): avg of [300,500,400] = 400.
    const history = buildPriceHistory({ current: b, transactions: [a, b, c] });

    expect(history).not.toBeNull();
    expect(history!.count).toBe(3);
    expect(history!.minCents).toBe(300);
    expect(history!.maxCents).toBe(500);
    expect(history!.avgCents).toBe(400);
    expect(history!.currentCents).toBe(500);
    expect(history!.deltaFromAvgCents).toBe(100);
    expect(history!.isPriciest).toBe(true);
    expect(history!.isCheapest).toBe(false);
  });

  it('flags the cheapest purchase and a negative delta', () => {
    const a = makeTx({ id: 'a', description: 'Café', baseCurrencyAmountCents: 300, date: '2026-06-01' });
    const b = makeTx({ id: 'b', description: 'Café', baseCurrencyAmountCents: 500, date: '2026-06-05' });
    const c = makeTx({ id: 'c', description: 'Café', baseCurrencyAmountCents: 400, date: '2026-06-03' });
    const history = buildPriceHistory({ current: a, transactions: [a, b, c] });

    expect(history!.isCheapest).toBe(true);
    expect(history!.isPriciest).toBe(false);
    expect(history!.deltaFromAvgCents).toBe(-100);
  });

  it('rounds the average to the nearest integer cent', () => {
    const a = makeTx({ id: 'a', description: 'Pão', baseCurrencyAmountCents: 100 });
    const b = makeTx({ id: 'b', description: 'Pão', baseCurrencyAmountCents: 100 });
    const c = makeTx({ id: 'c', description: 'Pão', baseCurrencyAmountCents: 101 });
    // (100 + 100 + 101) / 3 = 100.33 → 100
    const history = buildPriceHistory({ current: a, transactions: [a, b, c] });
    expect(history!.avgCents).toBe(100);
  });
});

describe('buildPriceHistory — matching set', () => {
  it('matches only the same normalized item, ignoring other items', () => {
    const a = makeTx({ id: 'a', description: 'Café', baseCurrencyAmountCents: 300 });
    const b = makeTx({ id: 'b', description: 'cafe  ', baseCurrencyAmountCents: 500 });
    const tea = makeTx({ id: 't', description: 'Chá', baseCurrencyAmountCents: 999 });
    const history = buildPriceHistory({ current: a, transactions: [a, b, tea] });

    expect(history!.count).toBe(2);
    expect(history!.maxCents).toBe(500); // tea's 999 excluded
  });

  it('excludes soft-deleted, non-expense and zero-amount records', () => {
    const a = makeTx({ id: 'a', description: 'Café', baseCurrencyAmountCents: 300 });
    const b = makeTx({ id: 'b', description: 'Café', baseCurrencyAmountCents: 500 });
    const deleted = makeTx({ id: 'd', description: 'Café', baseCurrencyAmountCents: 9000, deletedAt: '2026-06-09T00:00:00.000Z' });
    const income = makeTx({ id: 'i', description: 'Café', type: 'income', baseCurrencyAmountCents: 9000 });
    const zero = makeTx({ id: 'z', description: 'Café', baseCurrencyAmountCents: 0 });
    const history = buildPriceHistory({ current: a, transactions: [a, b, deleted, income, zero] });

    expect(history!.count).toBe(2);
    expect(history!.maxCents).toBe(500);
  });

  it('compares across currencies via the base-currency amount', () => {
    const a = makeTx({ id: 'a', description: 'Café', currency: 'EUR', baseCurrencyAmountCents: 300 });
    // a USD purchase whose original amount is huge but base value is small
    const b = makeTx({ id: 'b', description: 'Café', currency: 'USD', amountCents: 99_999, baseCurrencyAmountCents: 500 });
    const history = buildPriceHistory({ current: b, transactions: [a, b] });

    expect(history!.currentCents).toBe(500);
    expect(history!.maxCents).toBe(500);
    expect(history!.minCents).toBe(300);
  });
});

describe('buildPriceHistory — points', () => {
  it('returns every match newest-first and flags the current purchase', () => {
    const a = makeTx({ id: 'a', description: 'Café', baseCurrencyAmountCents: 300, date: '2026-06-01' });
    const b = makeTx({ id: 'b', description: 'Café', baseCurrencyAmountCents: 500, date: '2026-06-05' });
    const c = makeTx({ id: 'c', description: 'Café', baseCurrencyAmountCents: 400, date: '2026-06-03' });
    const history = buildPriceHistory({ current: c, transactions: [a, b, c] });

    expect(history!.points.map((p) => p.transactionId)).toEqual(['b', 'c', 'a']);
    expect(history!.points.find((p) => p.isCurrent)?.transactionId).toBe('c');
  });
});
