import { describe, it, expect } from 'vitest';
import {
  toCents,
  fromCents,
  formatMoney,
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
