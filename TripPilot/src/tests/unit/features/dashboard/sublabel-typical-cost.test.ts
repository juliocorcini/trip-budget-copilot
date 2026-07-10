import { describe, it, expect } from 'vitest';
import {
  categoryUnitKey,
  formatTypicalCostSublabel,
} from '@/features/dashboard/dashboard-format';

// G1 / DEC-489: sublabel shows typical cost instead of "done count".

describe('categoryUnitKey', () => {
  it('maps bar to night', () => {
    expect(categoryUnitKey('bar')).toBe('dashboard.unit_night');
  });

  it('maps market to trip', () => {
    expect(categoryUnitKey('market')).toBe('dashboard.unit_trip');
  });

  it('maps restaurant to meal', () => {
    expect(categoryUnitKey('restaurant')).toBe('dashboard.unit_meal');
  });

  it('maps transport to day', () => {
    expect(categoryUnitKey('transport')).toBe('dashboard.unit_day');
  });

  it('maps tours to outing', () => {
    expect(categoryUnitKey('tours')).toBe('dashboard.unit_outing');
  });

  it('falls back to unit_each for unknown categories', () => {
    expect(categoryUnitKey('unknown_thing')).toBe('dashboard.unit_each');
    expect(categoryUnitKey('other')).toBe('dashboard.unit_each');
  });
});

describe('formatTypicalCostSublabel', () => {
  const mockT = (key: string) => {
    const map: Record<string, string> = {
      'dashboard.unit_night': 'noite',
      'dashboard.unit_trip': 'ida',
      'dashboard.unit_meal': 'refeição',
      'dashboard.unit_day': 'dia',
      'dashboard.unit_each': 'vez',
    };
    return map[key] ?? key;
  };

  it('formats bar with typicalValueCents=3500 EUR as ~€35.00/noite', () => {
    const result = formatTypicalCostSublabel(3500, 'EUR', 'bar', mockT);
    expect(result).toMatch(/^~.*35.*\/noite$/);
  });

  it('formats market with typicalValueCents=1800 EUR', () => {
    const result = formatTypicalCostSublabel(1800, 'EUR', 'market', mockT);
    expect(result).toMatch(/^~.*18.*\/ida$/);
  });

  it('formats transport with typicalValueCents=900 USD', () => {
    const result = formatTypicalCostSublabel(900, 'USD', 'transport', mockT);
    expect(result).toMatch(/^~.*9.*\/dia$/);
  });

  it('returns null when typicalValueCents is 0', () => {
    expect(formatTypicalCostSublabel(0, 'EUR', 'bar', mockT)).toBeNull();
  });

  it('returns null when typicalValueCents is negative', () => {
    expect(formatTypicalCostSublabel(-100, 'EUR', 'bar', mockT)).toBeNull();
  });

  it('falls back to unit_each for unknown categories', () => {
    const result = formatTypicalCostSublabel(2000, 'EUR', 'other', mockT);
    expect(result).toMatch(/^~.*20.*\/vez$/);
  });
});
