import { describe, it, expect } from 'vitest';
import {
  suggestFromDescription,
  getFrequentExpenses,
  getCategoryTypicalCents,
  detectAmountAnomaly,
} from '@/domain/transactions';
import type { Transaction } from '@/domain/types/transaction';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null as string | null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

let counter = 0;
function mkExpense(
  overrides: Partial<Transaction> & { amountCents: number; category: string; description: string; date: string },
): Transaction {
  counter += 1;
  return {
    ...baseMeta,
    id: `tx-${counter}`,
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: 'w1',
    sessionId: null,
    type: 'expense',
    personalCostCents: overrides.amountCents,
    currency: 'EUR',
    baseCurrencyAmountCents: overrides.amountCents,
    exchangeRate: null,
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
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

describe('suggestFromDescription (M2)', () => {
  it('suggests category and value from the last expense with the same text', () => {
    const txs = [
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'Mercado', category: 'market', amountCents: 4000, date: '2026-06-02T10:00:00.000Z' }),
    ];
    const suggestion = suggestFromDescription(txs, 'café');
    expect(suggestion).not.toBeNull();
    expect(suggestion!.category).toBe('bar');
    expect(suggestion!.amountCents).toBe(250);
  });

  it('matches case-insensitively and ignores accents', () => {
    const txs = [mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-01T10:00:00.000Z' })];
    expect(suggestFromDescription(txs, 'CAFE')!.amountCents).toBe(250);
  });

  it('prefers the most recent matching expense', () => {
    const txs = [
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'Café', category: 'bar', amountCents: 300, date: '2026-06-05T10:00:00.000Z' }),
    ];
    expect(suggestFromDescription(txs, 'café')!.amountCents).toBe(300);
  });

  it('supports prefix matches when there is no exact match', () => {
    const txs = [mkExpense({ description: 'Café da manhã', category: 'bar', amountCents: 800, date: '2026-06-01T10:00:00.000Z' })];
    expect(suggestFromDescription(txs, 'café')!.amountCents).toBe(800);
  });

  it('returns null for queries shorter than two characters', () => {
    const txs = [mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-01T10:00:00.000Z' })];
    expect(suggestFromDescription(txs, 'c')).toBeNull();
  });

  it('ignores deleted transactions', () => {
    const txs = [
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-01T10:00:00.000Z', deletedAt: '2026-06-02T00:00:00.000Z' }),
    ];
    expect(suggestFromDescription(txs, 'café')).toBeNull();
  });
});

describe('getFrequentExpenses (M3)', () => {
  it('returns combinations seen at least twice, most frequent first', () => {
    const txs = [
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-02T10:00:00.000Z' }),
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-03T10:00:00.000Z' }),
      mkExpense({ description: 'Metrô', category: 'transport', amountCents: 180, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'Metrô', category: 'transport', amountCents: 180, date: '2026-06-02T10:00:00.000Z' }),
    ];
    const frequent = getFrequentExpenses(txs);
    expect(frequent).toHaveLength(2);
    expect(frequent[0]!.description).toBe('Café');
    expect(frequent[0]!.amountCents).toBe(250);
    expect(frequent[1]!.description).toBe('Metrô');
  });

  it('excludes one-off expenses (seen only once)', () => {
    const txs = [
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'Jantar caro', category: 'restaurant', amountCents: 9000, date: '2026-06-02T10:00:00.000Z' }),
    ];
    expect(getFrequentExpenses(txs)).toHaveLength(0);
  });

  it('respects the limit', () => {
    const txs: Transaction[] = [];
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      txs.push(mkExpense({ description: name, category: 'bar', amountCents: 100, date: '2026-06-01T10:00:00.000Z' }));
      txs.push(mkExpense({ description: name, category: 'bar', amountCents: 100, date: '2026-06-02T10:00:00.000Z' }));
    }
    expect(getFrequentExpenses(txs, 4)).toHaveLength(4);
  });

  it('treats different amounts as distinct favorites', () => {
    const txs = [
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'Café', category: 'bar', amountCents: 250, date: '2026-06-02T10:00:00.000Z' }),
      mkExpense({ description: 'Café', category: 'bar', amountCents: 400, date: '2026-06-03T10:00:00.000Z' }),
    ];
    const frequent = getFrequentExpenses(txs);
    expect(frequent).toHaveLength(1);
    expect(frequent[0]!.amountCents).toBe(250);
  });
});

describe('getCategoryTypicalCents (M5 baseline)', () => {
  it('returns the median of past expenses in a category', () => {
    const txs = [
      mkExpense({ description: 'a', category: 'bar', amountCents: 400, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'b', category: 'bar', amountCents: 600, date: '2026-06-02T10:00:00.000Z' }),
      mkExpense({ description: 'c', category: 'bar', amountCents: 800, date: '2026-06-03T10:00:00.000Z' }),
    ];
    expect(getCategoryTypicalCents(txs, 'bar')).toBe(600);
  });

  it('averages the two middle values for an even count', () => {
    const txs = [
      mkExpense({ description: 'a', category: 'bar', amountCents: 400, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'b', category: 'bar', amountCents: 500, date: '2026-06-02T10:00:00.000Z' }),
      mkExpense({ description: 'c', category: 'bar', amountCents: 700, date: '2026-06-03T10:00:00.000Z' }),
      mkExpense({ description: 'd', category: 'bar', amountCents: 900, date: '2026-06-04T10:00:00.000Z' }),
    ];
    expect(getCategoryTypicalCents(txs, 'bar')).toBe(600);
  });

  it('returns 0 without enough history (no anomaly without a baseline)', () => {
    const txs = [
      mkExpense({ description: 'a', category: 'bar', amountCents: 400, date: '2026-06-01T10:00:00.000Z' }),
      mkExpense({ description: 'b', category: 'bar', amountCents: 600, date: '2026-06-02T10:00:00.000Z' }),
    ];
    expect(getCategoryTypicalCents(txs, 'bar')).toBe(0);
  });
});

describe('detectAmountAnomaly (M5)', () => {
  it('flags an amount at least 3x the typical value', () => {
    expect(detectAmountAnomaly(18000, 600)).toBe(true);
    expect(detectAmountAnomaly(1800, 600)).toBe(true);
  });

  it('does not flag amounts within the normal range', () => {
    expect(detectAmountAnomaly(1500, 600)).toBe(false);
    expect(detectAmountAnomaly(600, 600)).toBe(false);
  });

  it('never flags when there is no baseline', () => {
    expect(detectAmountAnomaly(18000, 0)).toBe(false);
  });

  it('honors a custom factor', () => {
    expect(detectAmountAnomaly(1200, 600, 2)).toBe(true);
    expect(detectAmountAnomaly(1000, 600, 2)).toBe(false);
  });
});
