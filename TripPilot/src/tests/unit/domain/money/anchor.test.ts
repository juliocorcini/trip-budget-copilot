import { describe, it, expect } from 'vitest';
import { isAnchorActive, convertToAnchorCents, formatAnchorHint } from '@/domain/money';

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
