import { describe, it, expect } from 'vitest';
import {
  isAnchorActive,
  convertToAnchorCents,
  formatAnchorHint,
  anchorRateFromSnapshot,
  resolveAnchorRate,
} from '@/domain/money';
import type { FrozenExchangeRates } from '@/domain/types/common';

// DEC-128: mental currency anchor ("€20 ≈ R$ 124").

const BRL_AT_6_2 = { anchorCurrency: 'BRL', anchorRatePer1: 6.2 };

describe('isAnchorActive', () => {
  it('is active with a currency different from base and a positive rate', () => {
    expect(isAnchorActive(BRL_AT_6_2, 'EUR')).toBe(true);
  });

  it('is off when currency is null', () => {
    expect(isAnchorActive({ anchorCurrency: null, anchorRatePer1: 6.2 }, 'EUR')).toBe(false);
  });

  it('is off when rate is null or non-positive', () => {
    expect(isAnchorActive({ anchorCurrency: 'BRL', anchorRatePer1: null }, 'EUR')).toBe(false);
    expect(isAnchorActive({ anchorCurrency: 'BRL', anchorRatePer1: 0 }, 'EUR')).toBe(false);
    expect(isAnchorActive({ anchorCurrency: 'BRL', anchorRatePer1: -1 }, 'EUR')).toBe(false);
  });

  it('is off when the anchor equals the base currency', () => {
    expect(isAnchorActive({ anchorCurrency: 'EUR', anchorRatePer1: 1.0 }, 'EUR')).toBe(false);
  });
});

describe('convertToAnchorCents', () => {
  it('multiplies cents by the rate: €20.00 at 6.2 = R$ 124.00', () => {
    expect(convertToAnchorCents(2000, 6.2)).toBe(12400);
  });

  it('rounds to the nearest cent', () => {
    // 333 * 6.2 = 2064.6 → 2065
    expect(convertToAnchorCents(333, 6.2)).toBe(2065);
  });
});

describe('formatAnchorHint', () => {
  it('formats whole units with the ≈ prefix', () => {
    const hint = formatAnchorHint(2000, BRL_AT_6_2, 'EUR', 'pt-BR');
    expect(hint).not.toBeNull();
    expect(hint!.startsWith('\u2248')).toBe(true);
    expect(hint).toContain('124');
    // Whole units only — no decimal part on the mental reference.
    expect(hint).not.toContain(',00');
  });

  it('rounds the converted amount to whole units', () => {
    // 1050 cents * 6.2 = 6510 cents = R$ 65.10 → shown as R$ 65
    const hint = formatAnchorHint(1050, BRL_AT_6_2, 'EUR', 'pt-BR');
    expect(hint).toContain('65');
    expect(hint).not.toContain('65,1');
  });

  it('returns null when the anchor is inactive', () => {
    expect(formatAnchorHint(2000, { anchorCurrency: null, anchorRatePer1: null }, 'EUR')).toBeNull();
    expect(formatAnchorHint(2000, { anchorCurrency: 'EUR', anchorRatePer1: 1 }, 'EUR')).toBeNull();
  });
});

// DEC-434: the anchor rate now comes from the live FX snapshot (auto), with the
// manual rate as an offline fallback.
const EUR_SNAPSHOT: FrozenExchangeRates = {
  baseCurrency: 'EUR',
  fetchedAt: '2026-07-01T12:00:00.000Z',
  // base (EUR) units per 1 unit of X. 1 BRL = 0.16 EUR → 1 EUR = 6.25 BRL.
  ratesToBase: { BRL: 0.16, USD: 0.92 },
};

describe('anchorRateFromSnapshot (DEC-434)', () => {
  it('derives anchor-per-base as the inverse of ratesToBase[anchor]', () => {
    expect(anchorRateFromSnapshot(EUR_SNAPSHOT, 'BRL', 'EUR')).toBeCloseTo(6.25, 10);
  });

  it('is case-insensitive on the currency codes', () => {
    expect(anchorRateFromSnapshot(EUR_SNAPSHOT, 'brl', 'eur')).toBeCloseTo(6.25, 10);
  });

  it('returns null when the snapshot lacks the anchor currency', () => {
    expect(anchorRateFromSnapshot(EUR_SNAPSHOT, 'GBP', 'EUR')).toBeNull();
  });

  it('returns null when the snapshot is anchored to a different base', () => {
    expect(anchorRateFromSnapshot(EUR_SNAPSHOT, 'BRL', 'USD')).toBeNull();
  });

  it('returns null for a missing snapshot, no anchor, or anchor === base', () => {
    expect(anchorRateFromSnapshot(null, 'BRL', 'EUR')).toBeNull();
    expect(anchorRateFromSnapshot(EUR_SNAPSHOT, null, 'EUR')).toBeNull();
    expect(anchorRateFromSnapshot(EUR_SNAPSHOT, 'EUR', 'EUR')).toBeNull();
  });
});

describe('resolveAnchorRate (DEC-434 — auto first, manual fallback)', () => {
  it('prefers the live snapshot rate over the stored manual rate', () => {
    const rate = resolveAnchorRate({
      rates: EUR_SNAPSHOT,
      anchorCurrency: 'BRL',
      baseCurrency: 'EUR',
      manualRatePer1: 6.2,
    });
    expect(rate).toBeCloseTo(6.25, 10);
  });

  it('falls back to the manual rate when the snapshot cannot cover it (offline)', () => {
    expect(
      resolveAnchorRate({ rates: null, anchorCurrency: 'BRL', baseCurrency: 'EUR', manualRatePer1: 6.2 }),
    ).toBe(6.2);
    expect(
      resolveAnchorRate({ rates: EUR_SNAPSHOT, anchorCurrency: 'GBP', baseCurrency: 'EUR', manualRatePer1: 7.1 }),
    ).toBe(7.1);
  });

  it('returns null when neither an auto nor a positive manual rate exists', () => {
    expect(
      resolveAnchorRate({ rates: null, anchorCurrency: 'BRL', baseCurrency: 'EUR', manualRatePer1: null }),
    ).toBeNull();
    expect(
      resolveAnchorRate({ rates: null, anchorCurrency: 'BRL', baseCurrency: 'EUR', manualRatePer1: 0 }),
    ).toBeNull();
  });
});
