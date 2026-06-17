import { describe, it, expect } from 'vitest';
import {
  toCents,
  fromCents,
  formatMoney,
  formatMoneyCompact,
  splitEqually,
  sumCents,
  percentOf,
  centsPercentage,
} from '@/domain/money';

describe('toCents', () => {
  it('converts decimal to integer cents', () => {
    expect(toCents(14.99)).toBe(1499);
    expect(toCents(0)).toBe(0);
    expect(toCents(100)).toBe(10000);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(9.99)).toBe(999);
  });
});

describe('fromCents', () => {
  it('converts integer cents to decimal', () => {
    expect(fromCents(1499)).toBe(14.99);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(10000)).toBe(100);
    expect(fromCents(1)).toBe(0.01);
  });
});

describe('formatMoneyCompact (D-IMP-01 — calendar/heatmap cell labels)', () => {
  it('shows whole units, no symbol, under 1k', () => {
    expect(formatMoneyCompact(4600, 'en-US')).toBe('46');
    expect(formatMoneyCompact(4600, 'pt-BR')).toBe('46');
    expect(formatMoneyCompact(0, 'en-US')).toBe('0');
    expect(formatMoneyCompact(99, 'en-US')).toBe('1'); // €0,99 rounds to 1
  });

  it('collapses thousands to "k" with one decimal only while it informs', () => {
    expect(formatMoneyCompact(120000, 'en-US')).toBe('1.2k');
    expect(formatMoneyCompact(120000, 'pt-BR')).toBe('1,2k');
    expect(formatMoneyCompact(1200000, 'en-US')).toBe('12k'); // ≥10k drops the decimal
    expect(formatMoneyCompact(99900000, 'en-US')).toBe('999k');
  });

  it('collapses millions to "M"', () => {
    expect(formatMoneyCompact(100000000, 'en-US')).toBe('1M');
    expect(formatMoneyCompact(150000000, 'pt-BR')).toBe('1,5M');
  });

  it('keeps the sign for negative values and never crosses the 1k boundary wrong', () => {
    expect(formatMoneyCompact(-4600, 'en-US')).toBe('-46');
    // €999,60 rounds to 1000 → must read as "1k", not "1.000".
    expect(formatMoneyCompact(99960, 'en-US')).toBe('1k');
  });
});

describe('formatMoney', () => {
  it('formats cents as currency string', () => {
    const result = formatMoney(71750, 'EUR', 'pt-BR');
    expect(result).toContain('717,50');
  });

  it('formats zero', () => {
    const result = formatMoney(0, 'EUR', 'pt-BR');
    expect(result).toContain('0,00');
  });

  it('formats large amounts', () => {
    const result = formatMoney(150000, 'EUR', 'pt-BR');
    expect(result).toContain('1.500,00');
  });

  // BUG-010: a trip with an invalid baseCurrency (bad import/sync) must never
  // crash a render — formatMoney must always return a legible string.
  it('never throws on a malformed currency code and includes the raw code', () => {
    expect(() => formatMoney(1250, 'INVALID', 'pt-BR')).not.toThrow();
    const result = formatMoney(1250, 'INVALID', 'pt-BR');
    expect(result).toContain('12,50');
    expect(result).toContain('INVALID');
  });

  it('never throws on an empty currency', () => {
    expect(() => formatMoney(1250, '', 'pt-BR')).not.toThrow();
    expect(formatMoney(1250, '', 'pt-BR')).toContain('12,50');
  });

  it('does not throw on a well-formed but unknown ISO code', () => {
    expect(() => formatMoney(1250, 'XYZ', 'pt-BR')).not.toThrow();
    expect(formatMoney(1250, 'XYZ', 'pt-BR')).toContain('12,50');
  });

  it('normalizes lowercase currency codes', () => {
    const result = formatMoney(71750, 'eur', 'pt-BR');
    expect(result).toContain('717,50');
  });
});

describe('splitEqually', () => {
  it('splits evenly divisible amount', () => {
    expect(splitEqually(900, 3)).toEqual([300, 300, 300]);
  });

  it('distributes remainder to first participants', () => {
    const result = splitEqually(1000, 3);
    expect(result).toEqual([334, 333, 333]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('handles single person', () => {
    expect(splitEqually(1000, 1)).toEqual([1000]);
  });

  it('handles zero parts', () => {
    expect(splitEqually(1000, 0)).toEqual([]);
  });

  it('handles 2-way split with remainder', () => {
    const result = splitEqually(1001, 2);
    expect(result).toEqual([501, 500]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1001);
  });
});

describe('sumCents', () => {
  it('sums array of cent values', () => {
    expect(sumCents([5000, 3200])).toBe(8200);
    expect(sumCents([])).toBe(0);
    expect(sumCents([100])).toBe(100);
  });
});

describe('percentOf', () => {
  it('calculates percentage of cents', () => {
    expect(percentOf(10000, 50)).toBe(5000);
    expect(percentOf(10000, 25)).toBe(2500);
    expect(percentOf(333, 10)).toBe(33);
  });
});

describe('centsPercentage', () => {
  it('calculates what percentage part is of total', () => {
    expect(centsPercentage(5000, 10000)).toBe(50);
    expect(centsPercentage(0, 10000)).toBe(0);
    expect(centsPercentage(100, 0)).toBe(0);
  });
});
