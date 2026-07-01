import { describe, it, expect } from 'vitest';
import {
  MAJOR_CURRENCY_CODES,
  currencyPriority,
  sortByCurrencyPriority,
  currencyFlag,
  isFxSnapshotStale,
  FX_REFRESH_INTERVAL_MS,
  listSelectableCurrencies,
} from '@/domain/money';
import type { FrozenExchangeRates } from '@/domain/types/common';

// DEC-423 (G8): the picker surfaces the majors first (fixed order) then the rest
// alphabetically, with a flag for a friendlier row, and the snapshot auto-refreshes
// past 12h. None of this touches the base-anchored conversion math.

describe('currencyPriority (DEC-423)', () => {
  it('ranks the majors by their fixed index and everything else last', () => {
    expect(currencyPriority('BRL')).toBe(0);
    expect(currencyPriority('usd')).toBe(1); // case-insensitive
    expect(currencyPriority('JPY')).toBe(6);
    expect(currencyPriority('CZK')).toBe(Number.POSITIVE_INFINITY);
    expect(currencyPriority('ZZZ')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('sortByCurrencyPriority (DEC-423)', () => {
  it('puts the majors first in their fixed order, then the rest alphabetically', () => {
    const sorted = sortByCurrencyPriority(['ZAR', 'JPY', 'CZK', 'USD', 'ARS', 'EUR']);
    // majors in fixed order: USD(1), EUR(2), JPY(6); then alpha: ARS, CZK, ZAR.
    expect(sorted).toEqual(['USD', 'EUR', 'JPY', 'ARS', 'CZK', 'ZAR']);
  });

  it('is a pure sort (does not dedupe or upper-case)', () => {
    expect(sortByCurrencyPriority(['CZK', 'BRL'])).toEqual(['BRL', 'CZK']);
    expect([...MAJOR_CURRENCY_CODES]).toEqual(['BRL', 'USD', 'EUR', 'CAD', 'CHF', 'GBP', 'JPY']);
  });
});

describe('currencyFlag (DEC-423)', () => {
  it('maps the euro to the EU flag', () => {
    expect(currencyFlag('EUR')).toBe('\u{1F1EA}\u{1F1FA}');
  });

  it('derives the flag from the ISO country prefix for normal codes', () => {
    expect(currencyFlag('USD')).toBe('\u{1F1FA}\u{1F1F8}'); // 🇺🇸
    expect(currencyFlag('brl')).toBe('\u{1F1E7}\u{1F1F7}'); // 🇧🇷 (case-insensitive)
    expect(currencyFlag('JPY')).toBe('\u{1F1EF}\u{1F1F5}'); // 🇯🇵
  });

  it('returns empty (never a wrong flag) for multi-country or invalid codes', () => {
    expect(currencyFlag('XOF')).toBe(''); // West African CFA — no single country
    expect(currencyFlag('E')).toBe('');
    expect(currencyFlag('12A')).toBe('');
  });
});

describe('listSelectableCurrencies ordering (DEC-423)', () => {
  it('keeps the base first, then majors, then the rest alphabetically', () => {
    // base = CZK (a non-major) stays pinned at index 0; the tail is prioritized.
    const list = listSelectableCurrencies('CZK', ['ZAR', 'USD', 'BRL', 'ARS', 'JPY']);
    expect(list).toEqual(['CZK', 'BRL', 'USD', 'JPY', 'ARS', 'ZAR']);
  });

  it('still de-duplicates and upper-cases with the base pinned', () => {
    expect(listSelectableCurrencies('EUR', ['eur', 'gbp', 'CZK', 'usd'])).toEqual([
      'EUR', // base pinned
      'USD', // major (index 1)
      'GBP', // major (index 5)
      'CZK', // rest alpha
    ]);
  });
});

describe('isFxSnapshotStale (DEC-423 — 12h auto-refresh gate)', () => {
  const at = (iso: string): FrozenExchangeRates => ({
    baseCurrency: 'EUR',
    fetchedAt: iso,
    ratesToBase: { USD: 0.92 },
  });

  it('treats a missing snapshot as stale (first open pulls rates)', () => {
    expect(isFxSnapshotStale(null, new Date())).toBe(true);
  });

  it('is fresh under 12h and stale at/after 12h', () => {
    const now = new Date('2026-06-20T21:00:00.000Z');
    expect(isFxSnapshotStale(at('2026-06-20T10:00:00.000Z'), now)).toBe(false); // 11h
    expect(isFxSnapshotStale(at('2026-06-20T09:00:00.000Z'), now)).toBe(true); // exactly 12h
    expect(isFxSnapshotStale(at('2026-06-19T09:00:00.000Z'), now)).toBe(true); // 36h
  });

  it('treats an unparsable timestamp as stale and a future one as fresh', () => {
    const now = new Date('2026-06-20T21:00:00.000Z');
    expect(isFxSnapshotStale(at('not-a-date'), now)).toBe(true);
    expect(isFxSnapshotStale(at('2026-06-21T09:00:00.000Z'), now)).toBe(false);
  });

  it('exposes the 12h default interval', () => {
    expect(FX_REFRESH_INTERVAL_MS).toBe(12 * 60 * 60 * 1000);
  });
});
