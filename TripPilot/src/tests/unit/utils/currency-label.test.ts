import { describe, it, expect } from 'vitest';
import { buildCurrencyOptionLabel } from '@/utils/currency-label';

// DEC-473 — the app-standard currency option label: majors read as
// flag + code + localized name; minors stay a bare code.

describe('buildCurrencyOptionLabel', () => {
  it('gives majors a flag, the code and a localized name', () => {
    const brl = buildCurrencyOptionLabel('BRL', 'pt-BR');
    expect(brl).toContain('🇧🇷');
    expect(brl).toContain('BRL');
    expect(brl.toLowerCase()).toContain('real');

    const eur = buildCurrencyOptionLabel('EUR', 'en');
    expect(eur).toContain('🇪🇺');
    expect(eur).toContain('EUR');
    expect(eur.toLowerCase()).toContain('euro');
  });

  it('keeps minors as a bare code', () => {
    expect(buildCurrencyOptionLabel('PLN', 'pt-BR')).toBe('PLN');
    expect(buildCurrencyOptionLabel('THB', 'en')).toBe('THB');
  });

  it('normalizes casing/whitespace before classifying', () => {
    expect(buildCurrencyOptionLabel(' usd ', 'en')).toContain('USD');
    expect(buildCurrencyOptionLabel(' usd ', 'en')).toContain('🇺🇸');
  });
});
