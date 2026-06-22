import { describe, it, expect } from 'vitest';
import {
  pairRate,
  convertAmount,
  convertWithManualRate,
  converterCurrencies,
  rateAgeDays,
} from '@/domain/money';
import type { FrozenExchangeRates } from '@/domain/types/common';

// FB-04 (DEC-256): the converter is a PURE read over the frozen FX snapshot.
// `ratesToBase[X]` = base units per 1 X (base implicitly 1). A FROM->TO pair is
// routed through the base: rate = basePerFrom / basePerTo. The math must be exact
// and the direction unambiguous (a converter that lies is worse than none).

// Base = EUR. 1 BRL = 0.18 EUR; 1 USD = 0.92 EUR; 1 CZK = 0.04 EUR.
const RATES: FrozenExchangeRates = {
  baseCurrency: 'EUR',
  fetchedAt: '2026-06-20T09:00:00.000Z',
  ratesToBase: { BRL: 0.18, USD: 0.92, CZK: 0.04 },
};

describe('pairRate (FB-04)', () => {
  it('is 1 for a same-currency pair (even with no snapshot)', () => {
    expect(pairRate('EUR', 'EUR', RATES)).toBe(1);
    expect(pairRate('brl', 'BRL', null)).toBe(1);
  });

  it('converts FROM the base: 1 EUR -> BRL is 1/0.18', () => {
    // basePerFrom(EUR)=1, basePerTo(BRL)=0.18 -> 1/0.18 ≈ 5.5556 BRL per EUR.
    expect(pairRate('EUR', 'BRL', RATES)).toBeCloseTo(1 / 0.18, 10);
  });

  it('converts TO the base: 1 BRL -> EUR is 0.18', () => {
    expect(pairRate('BRL', 'EUR', RATES)).toBeCloseTo(0.18, 10);
  });

  it('routes a cross pair through the base: 1 USD -> BRL = 0.92 / 0.18', () => {
    expect(pairRate('USD', 'BRL', RATES)).toBeCloseTo(0.92 / 0.18, 10);
  });

  it('is the exact inverse in both directions (USD<->BRL)', () => {
    const ab = pairRate('USD', 'BRL', RATES)!;
    const ba = pairRate('BRL', 'USD', RATES)!;
    expect(ab * ba).toBeCloseTo(1, 12);
  });

  it('tolerates lower-case / padded codes', () => {
    expect(pairRate('  eur ', 'brl', RATES)).toBeCloseTo(1 / 0.18, 10);
  });

  it('returns null when a currency is missing from the snapshot', () => {
    expect(pairRate('EUR', 'JPY', RATES)).toBeNull();
    expect(pairRate('JPY', 'BRL', RATES)).toBeNull();
  });

  it('returns null for a non-base pair when there is no snapshot', () => {
    expect(pairRate('USD', 'BRL', null)).toBeNull();
  });

  it('ignores a non-positive/garbage rate entry', () => {
    const bad: FrozenExchangeRates = {
      baseCurrency: 'EUR',
      fetchedAt: RATES.fetchedAt,
      // @ts-expect-error — exercising defensive coercion against junk snapshots
      ratesToBase: { BRL: 0, USD: -1, GBP: 'x' },
    };
    expect(pairRate('EUR', 'BRL', bad)).toBeNull();
    expect(pairRate('EUR', 'USD', bad)).toBeNull();
    expect(pairRate('EUR', 'GBP', bad)).toBeNull();
  });
});

describe('convertAmount (FB-04)', () => {
  it('converts 20 EUR -> ~111.11 BRL', () => {
    const r = convertAmount(20, 'EUR', 'BRL', RATES)!;
    expect(r.amount).toBeCloseTo(20 / 0.18, 8);
    expect(r.rate).toBeCloseTo(1 / 0.18, 10);
  });

  it('converts 50 BRL -> 9 EUR exactly', () => {
    const r = convertAmount(50, 'BRL', 'EUR', RATES)!;
    expect(r.amount).toBeCloseTo(9, 10); // 50 * 0.18
  });

  it('returns the amount unchanged for a same-currency convert', () => {
    expect(convertAmount(42, 'EUR', 'EUR', RATES)).toEqual({ amount: 42, rate: 1 });
  });

  it('accepts zero and rejects a negative/NaN amount', () => {
    expect(convertAmount(0, 'EUR', 'BRL', RATES)!.amount).toBe(0);
    expect(convertAmount(-1, 'EUR', 'BRL', RATES)).toBeNull();
    expect(convertAmount(Number.NaN, 'EUR', 'BRL', RATES)).toBeNull();
  });

  it('returns null when the pair is unresolvable (caller asks for a manual rate)', () => {
    expect(convertAmount(10, 'EUR', 'JPY', RATES)).toBeNull();
  });
});

describe('convertWithManualRate (FB-04 — offline / override)', () => {
  it('multiplies by the manual rate', () => {
    expect(convertWithManualRate(20, 5.5)).toEqual({ amount: 110, rate: 5.5 });
  });

  it('rejects a non-positive rate or a bad amount', () => {
    expect(convertWithManualRate(20, 0)).toBeNull();
    expect(convertWithManualRate(20, -3)).toBeNull();
    expect(convertWithManualRate(-1, 5)).toBeNull();
  });
});

describe('converterCurrencies (FB-04)', () => {
  it('lists base first, then snapshot + extra, de-duplicated and upper-cased', () => {
    const list = converterCurrencies(RATES, ['brl', 'GBP']);
    expect(list[0]).toBe('EUR');
    expect(new Set(list)).toEqual(new Set(['EUR', 'BRL', 'USD', 'CZK', 'GBP']));
    // de-dup: BRL from the snapshot AND the extra appears once.
    expect(list.filter((c) => c === 'BRL')).toHaveLength(1);
  });

  it('falls back to the extra currencies when there is no snapshot', () => {
    expect(converterCurrencies(null, ['USD', 'BRL'])).toEqual(['USD', 'BRL']);
  });
});

describe('rateAgeDays (FB-04 — honesty stamp)', () => {
  it('counts whole days since the snapshot was fetched', () => {
    const now = new Date('2026-06-23T10:00:00.000Z'); // ~3 days after 06-20T09:00
    expect(rateAgeDays(RATES, now)).toBe(3);
  });

  it('is 0 on the same day and clamps a future timestamp to 0', () => {
    expect(rateAgeDays(RATES, new Date('2026-06-20T20:00:00.000Z'))).toBe(0);
    expect(rateAgeDays(RATES, new Date('2026-06-19T00:00:00.000Z'))).toBe(0);
  });

  it('returns null without a snapshot or with an unusable timestamp', () => {
    expect(rateAgeDays(null, new Date())).toBeNull();
    expect(
      rateAgeDays({ baseCurrency: 'EUR', fetchedAt: 'not-a-date', ratesToBase: {} }, new Date()),
    ).toBeNull();
  });
});
