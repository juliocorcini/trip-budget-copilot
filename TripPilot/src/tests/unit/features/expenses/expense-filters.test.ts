import { describe, it, expect, beforeEach } from 'vitest';
import {
  countActiveFilters,
  hasActiveFilter,
  matchesExpenseScope,
  readExpenseScopeFromParams,
  isExpenseScopeActive,
  resolvePhaseScopeDefault,
  recallPhaseScope,
  rememberPhaseScope,
  clearPhaseScopeMemory,
  type ExpenseFilterState,
  type ExpenseScope,
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
        state({ category: 'bar', place: 'Mercadona', profileId: 'p1', walletNull: true }),
      ),
    ).toBe(4);
  });

  it('treats an empty string category/place as not filtering', () => {
    expect(countActiveFilters(state({ category: '', place: '' }))).toBe(0);
    expect(hasActiveFilter(state({ category: '' }))).toBe(false);
  });

  it('DEC-453: the phase scope NEVER counts — it is a first-class selector, not a filter', () => {
    expect(countActiveFilters(state({ phaseId: 'phase-1' }))).toBe(0);
    expect(hasActiveFilter(state({ phaseId: 'phase-1' }))).toBe(false);
    expect(countActiveFilters(state({ phaseId: 'all' }))).toBe(0);
    expect(countActiveFilters(state({ phaseId: 'phase-1', category: 'bar' }))).toBe(1);
  });
});

describe('matchesExpenseScope (DEC-453 — list and map share ONE predicate)', () => {
  const tx = (over: Partial<Parameters<typeof matchesExpenseScope>[0]> = {}) => ({
    deletedAt: null,
    phaseId: 'phase-1',
    category: 'bar',
    activityProfileId: 'prof-1',
    placeLabel: 'Mercadona',
    ...over,
  });
  const scope = (over: Partial<ExpenseScope> = {}): ExpenseScope => ({
    phaseId: 'all',
    category: null,
    profileId: null,
    place: null,
    ...over,
  });

  it('open scope matches every live transaction', () => {
    expect(matchesExpenseScope(tx(), scope())).toBe(true);
  });

  it('never matches a deleted transaction', () => {
    expect(matchesExpenseScope(tx({ deletedAt: '2026-07-01T00:00:00.000Z' }), scope())).toBe(false);
  });

  it('phase scope keeps only that phase', () => {
    expect(matchesExpenseScope(tx(), scope({ phaseId: 'phase-1' }))).toBe(true);
    expect(matchesExpenseScope(tx({ phaseId: 'phase-2' }), scope({ phaseId: 'phase-1' }))).toBe(false);
  });

  it('category, profile and place each narrow independently', () => {
    expect(matchesExpenseScope(tx(), scope({ category: 'bar' }))).toBe(true);
    expect(matchesExpenseScope(tx(), scope({ category: 'food' }))).toBe(false);
    expect(matchesExpenseScope(tx(), scope({ profileId: 'prof-1' }))).toBe(true);
    expect(matchesExpenseScope(tx(), scope({ profileId: 'prof-2' }))).toBe(false);
    expect(matchesExpenseScope(tx(), scope({ place: 'Mercadona' }))).toBe(true);
    expect(matchesExpenseScope(tx(), scope({ place: 'Lidl' }))).toBe(false);
  });

  it('all scopes must match together (AND semantics)', () => {
    const narrow = scope({ phaseId: 'phase-1', category: 'bar', place: 'Mercadona' });
    expect(matchesExpenseScope(tx(), narrow)).toBe(true);
    expect(matchesExpenseScope(tx({ category: 'food' }), narrow)).toBe(false);
  });
});

describe('readExpenseScopeFromParams / isExpenseScopeActive (DEC-453 — list → map)', () => {
  it('no params = open scope (whole trip), inactive', () => {
    const parsed = readExpenseScopeFromParams(new URLSearchParams());
    expect(parsed).toEqual({ phaseId: 'all', category: null, profileId: null, place: null });
    expect(isExpenseScopeActive(parsed)).toBe(false);
  });

  it('round-trips the params the list writes', () => {
    const params = new URLSearchParams('phase=phase-9&category=bar&place=Mercadona&profile=p1');
    const parsed = readExpenseScopeFromParams(params);
    expect(parsed).toEqual({
      phaseId: 'phase-9',
      category: 'bar',
      profileId: 'p1',
      place: 'Mercadona',
    });
    expect(isExpenseScopeActive(parsed)).toBe(true);
  });

  it('a lone phase param already marks the scope active', () => {
    expect(isExpenseScopeActive(readExpenseScopeFromParams(new URLSearchParams('phase=x')))).toBe(true);
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
