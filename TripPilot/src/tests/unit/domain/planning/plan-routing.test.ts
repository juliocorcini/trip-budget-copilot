import { describe, it, expect } from 'vitest';
import {
  routePlannedExpense,
  outcomeCreatesEvent,
  outcomeCreatesNewPot,
  outcomeCreatesPurchase,
  outcomeFundedByPhase,
  type PlannedExpenseOutcome,
} from '@/domain/planning/plan-routing';

describe('routePlannedExpense (GATE 4 — the 2×3 single-door table)', () => {
  it('dated + from the phase → a trecho-funded Event', () => {
    expect(routePlannedExpense(true, 'phase')).toBe('event_phase');
  });

  it('dated + new pot → Event with a new Pote (Tomorrowland)', () => {
    expect(routePlannedExpense(true, 'new_pot')).toBe('event_new_pot');
  });

  it('dated + existing pot → Event funded by an existing Pote', () => {
    expect(routePlannedExpense(true, 'existing_pot')).toBe('event_existing_pot');
  });

  it('undated + from the phase → a trecho-funded Compra planejada', () => {
    expect(routePlannedExpense(false, 'phase')).toBe('purchase_phase');
  });

  it('undated + new pot → a standalone Pote (money apart, no date)', () => {
    expect(routePlannedExpense(false, 'new_pot')).toBe('pot');
  });

  it('undated + existing pot → a Compra drawing from an existing Pote', () => {
    expect(routePlannedExpense(false, 'existing_pot')).toBe('purchase_existing_pot');
  });
});

describe('outcome classifiers', () => {
  const outcomes: PlannedExpenseOutcome[] = [
    'event_phase',
    'event_new_pot',
    'event_existing_pot',
    'purchase_phase',
    'purchase_existing_pot',
    'pot',
  ];

  it('creates an event only for the three event outcomes', () => {
    expect(outcomes.filter(outcomeCreatesEvent)).toEqual([
      'event_phase',
      'event_new_pot',
      'event_existing_pot',
    ]);
  });

  it('creates a new pot only for event_new_pot and the standalone pot', () => {
    expect(outcomes.filter(outcomeCreatesNewPot)).toEqual(['event_new_pot', 'pot']);
  });

  it('creates a purchase only for the two purchase outcomes', () => {
    expect(outcomes.filter(outcomeCreatesPurchase)).toEqual([
      'purchase_phase',
      'purchase_existing_pot',
    ]);
  });

  it('is funded by the phase (subtracts from the trecho) only for *_phase outcomes', () => {
    expect(outcomes.filter(outcomeFundedByPhase)).toEqual(['event_phase', 'purchase_phase']);
  });

  it('every outcome creates exactly one primary item (event XOR purchase XOR standalone pot)', () => {
    for (const o of outcomes) {
      const primaries =
        Number(outcomeCreatesEvent(o)) +
        Number(outcomeCreatesPurchase(o)) +
        Number(o === 'pot');
      expect(primaries).toBe(1);
    }
  });
});
