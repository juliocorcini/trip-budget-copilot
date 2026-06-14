import { describe, it, expect } from 'vitest';
import {
  convertToBaseCents,
  transactionBasePersonalCostCents,
  resolveFrozenRate,
  listSelectableCurrencies,
} from '@/domain/money/exchange';
import { calculatePoolSpent } from '@/domain/budget';
import type { Transaction } from '@/domain/types/transaction';
import type { FrozenExchangeRates } from '@/domain/types/common';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

interface TxOverrides {
  amountCents: number;
  currency?: string;
  personalCostCents?: number | null;
  baseCurrencyAmountCents?: number;
  exchangeRate?: number | null;
  type?: Transaction['type'];
}

const mkTx = (id: string, o: TxOverrides): Transaction => ({
  ...baseMeta,
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: 'w1',
  sessionId: null,
  type: o.type ?? 'expense',
  amountCents: o.amountCents,
  personalCostCents: o.personalCostCents === undefined ? o.amountCents : o.personalCostCents,
  currency: o.currency ?? 'EUR',
  baseCurrencyAmountCents: o.baseCurrencyAmountCents ?? o.amountCents,
  exchangeRate: o.exchangeRate ?? null,
  category: 'bar',
  subcategoryId: null,
  placeLabel: null,
  latitude: null,
  longitude: null,
  placeId: null,
  description: 'test',
  date: '2026-01-01T00:00:00.000Z',
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

describe('convertToBaseCents', () => {
  it('converts a foreign cents amount to base cents (1000 CZK × 0.04 = 40 EUR)', () => {
    // 100000 cents = 1000.00 CZK; rate 0.04 base per 1 foreign → 4000 cents = 40.00 EUR
    expect(convertToBaseCents(100000, 0.04)).toBe(4000);
  });

  it('rounds to the nearest base cent', () => {
    // 12345 × 0.04 = 493.8 → 494
    expect(convertToBaseCents(12345, 0.04)).toBe(494);
    // 12340 × 0.04 = 493.6 → 494
    expect(convertToBaseCents(12340, 0.04)).toBe(494);
    // 12300 × 0.04 = 492.0 → 492
    expect(convertToBaseCents(12300, 0.04)).toBe(492);
  });

  it('is identity for a 1:1 rate', () => {
    expect(convertToBaseCents(5000, 1)).toBe(5000);
  });
});

describe('transactionBasePersonalCostCents', () => {
  it('returns the original cost for same-currency expenses (rate null)', () => {
    expect(transactionBasePersonalCostCents(mkTx('t1', { amountCents: 5000 }))).toBe(5000);
  });

  it('scales a foreign non-shared expense by the stored rate', () => {
    const tx = mkTx('t2', {
      amountCents: 100000,
      currency: 'CZK',
      baseCurrencyAmountCents: 4000,
      exchangeRate: 0.04,
    });
    expect(transactionBasePersonalCostCents(tx)).toBe(4000);
  });

  it('scales the personal share (not the full amount) for a shared foreign expense', () => {
    const tx = mkTx('t3', {
      amountCents: 100000,
      currency: 'CZK',
      personalCostCents: 50000,
      baseCurrencyAmountCents: 4000,
      exchangeRate: 0.04,
    });
    // 50000 × 0.04 = 2000 (half of the base value)
    expect(transactionBasePersonalCostCents(tx)).toBe(2000);
  });

  it('falls back to the amount when personal cost is null', () => {
    const tx = mkTx('t4', {
      amountCents: 100000,
      currency: 'CZK',
      personalCostCents: null,
      exchangeRate: 0.04,
    });
    expect(transactionBasePersonalCostCents(tx)).toBe(4000);
  });
});

describe('resolveFrozenRate', () => {
  const frozen: FrozenExchangeRates = {
    baseCurrency: 'EUR',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    ratesToBase: { CZK: 0.04, USD: 0.92 },
  };

  it('returns null for the base currency itself', () => {
    expect(resolveFrozenRate(frozen, 'EUR', 'EUR')).toBeNull();
  });

  it('returns the stored rate for a known foreign currency', () => {
    expect(resolveFrozenRate(frozen, 'CZK', 'EUR')).toBe(0.04);
  });

  it('returns null when no snapshot exists', () => {
    expect(resolveFrozenRate(null, 'CZK', 'EUR')).toBeNull();
  });

  it('returns null when the snapshot is for a different base currency', () => {
    expect(resolveFrozenRate(frozen, 'CZK', 'USD')).toBeNull();
  });

  it('returns null for a currency missing from the snapshot', () => {
    expect(resolveFrozenRate(frozen, 'GBP', 'EUR')).toBeNull();
  });
});

describe('listSelectableCurrencies', () => {
  it('puts the base first, de-duplicates and upper-cases', () => {
    expect(listSelectableCurrencies('EUR', ['eur', 'USD', 'usd', 'CZK'])).toEqual([
      'EUR',
      'USD',
      'CZK',
    ]);
  });

  it('ignores empty/blank codes', () => {
    expect(listSelectableCurrencies('EUR', ['', '  ', 'BRL'])).toEqual(['EUR', 'BRL']);
  });
});

describe('calculatePoolSpent (multi-currency)', () => {
  it('sums foreign expenses by their base value, leaving same-currency intact', () => {
    const eur = mkTx('e1', { amountCents: 5000 }); // 50.00 EUR
    const czk = mkTx('e2', {
      amountCents: 100000, // 1000.00 CZK
      currency: 'CZK',
      baseCurrencyAmountCents: 4000,
      exchangeRate: 0.04, // → 40.00 EUR
    });
    expect(calculatePoolSpent([eur, czk])).toBe(9000); // 5000 + 4000
  });
});
