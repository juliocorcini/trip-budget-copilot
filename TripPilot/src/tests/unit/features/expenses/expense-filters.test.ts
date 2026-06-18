import { describe, it, expect } from 'vitest';
import {
  countActiveFilters,
  hasActiveFilter,
  type ExpenseFilterState,
} from '@/features/expenses/expense-filters';

const state = (over: Partial<ExpenseFilterState> = {}): ExpenseFilterState => ({
  category: null,
  profileId: null,
  walletNull: false,
  place: null,
  ...over,
});

describe('expense-filters (audit 4.4 — grouped/collapsible chips)', () => {
  it('counts zero when nothing is filtering', () => {
    expect(countActiveFilters(state())).toBe(0);
    expect(hasActiveFilter(state())).toBe(false);
  });

  it('counts a single active scope', () => {
    expect(countActiveFilters(state({ category: 'bar' }))).toBe(1);
    expect(countActiveFilters(state({ place: 'Mercadona' }))).toBe(1);
    expect(countActiveFilters(state({ profileId: 'p1' }))).toBe(1);
    expect(countActiveFilters(state({ walletNull: true }))).toBe(1);
    expect(hasActiveFilter(state({ category: 'bar' }))).toBe(true);
  });

  it('sums every independent scope that is active', () => {
    expect(
      countActiveFilters(state({ category: 'bar', place: 'Mercadona', profileId: 'p1', walletNull: true })),
    ).toBe(4);
  });

  it('treats an empty string category/place as not filtering', () => {
    expect(countActiveFilters(state({ category: '', place: '' }))).toBe(0);
    expect(hasActiveFilter(state({ category: '' }))).toBe(false);
  });
});
