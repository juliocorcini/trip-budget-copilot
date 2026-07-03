import { describe, it, expect, beforeEach } from 'vitest';
import {
  countActiveFilters,
  hasActiveFilter,
  resolvePhaseScopeDefault,
  recallPhaseScope,
  rememberPhaseScope,
  clearPhaseScopeMemory,
  type ExpenseFilterState,
} from '@/features/expenses/expense-filters';

const state = (over: Partial<ExpenseFilterState> = {}): ExpenseFilterState => ({
  phaseId: 'all',
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
      countActiveFilters(
        state({ phaseId: 'phase-1', category: 'bar', place: 'Mercadona', profileId: 'p1', walletNull: true }),
      ),
    ).toBe(5);
  });

  it('treats an empty string category/place as not filtering', () => {
    expect(countActiveFilters(state({ category: '', place: '' }))).toBe(0);
    expect(hasActiveFilter(state({ category: '' }))).toBe(false);
  });

  it('DEC-448: a phase scope counts as an active filter; "all" does not', () => {
    expect(countActiveFilters(state({ phaseId: 'phase-1' }))).toBe(1);
    expect(hasActiveFilter(state({ phaseId: 'phase-1' }))).toBe(true);
    expect(countActiveFilters(state({ phaseId: 'all' }))).toBe(0);
  });
});

describe('resolvePhaseScopeDefault (DEC-448 / D04)', () => {
  it('multi-phase trip with an active phase → defaults to that phase', () => {
    expect(
      resolvePhaseScopeDefault({ isOngoing: false, activePhaseId: 'phase-2', phaseCount: 3 }),
    ).toBe('phase-2');
  });

  it('single-phase trip → "all" (the scope would be a no-op)', () => {
    expect(
      resolvePhaseScopeDefault({ isOngoing: false, activePhaseId: 'phase-1', phaseCount: 1 }),
    ).toBe('all');
  });

  it('Dia a dia (ongoing) space → "all"', () => {
    expect(
      resolvePhaseScopeDefault({ isOngoing: true, activePhaseId: 'phase-1', phaseCount: 2 }),
    ).toBe('all');
  });

  it('no resolvable active phase → "all"', () => {
    expect(resolvePhaseScopeDefault({ isOngoing: false, activePhaseId: null, phaseCount: 2 })).toBe(
      'all',
    );
  });
});

describe('phase scope session memory (DEC-448 — "escolha lembrada na sessão")', () => {
  beforeEach(() => clearPhaseScopeMemory());

  it('recalls nothing before a choice is made', () => {
    expect(recallPhaseScope('trip-1')).toBeNull();
  });

  it('remembers the last choice per trip', () => {
    rememberPhaseScope('trip-1', 'all');
    rememberPhaseScope('trip-2', 'phase-9');
    expect(recallPhaseScope('trip-1')).toBe('all');
    expect(recallPhaseScope('trip-2')).toBe('phase-9');
  });
});
