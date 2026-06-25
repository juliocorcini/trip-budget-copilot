import { describe, it, expect } from 'vitest';
import {
  routePlannedExpense,
  outcomeCreatesEvent,
  outcomeCreatesNewPot,
  outcomeCreatesPhasePot,
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

  it('undated + new pot (default/trip scope) → a standalone Pote (money apart, no date)', () => {
    expect(routePlannedExpense(false, 'new_pot')).toBe('pot');
    expect(routePlannedExpense(false, 'new_pot', 'trip')).toBe('pot');
  });

  it('undated + new pot + phase scope → a phase-scoped Pote/Fundo (E01/DEC-321)', () => {
    expect(routePlannedExpense(false, 'new_pot', 'phase')).toBe('pot_phase');
  });

  it('potScope never changes a dated, phase, or existing-pot outcome', () => {
    expect(routePlannedExpense(true, 'new_pot', 'phase')).toBe('event_new_pot');
    expect(routePlannedExpense(false, 'phase', 'phase')).toBe('purchase_phase');
    expect(routePlannedExpense(false, 'existing_pot', 'phase')).toBe('purchase_existing_pot');
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
    'pot_phase',
  ];

  it('creates an event only for the three event outcomes', () => {
    expect(outcomes.filter(outcomeCreatesEvent)).toEqual([
      'event_phase',
      'event_new_pot',
      'event_existing_pot',
    ]);
  });

  it('creates a new pot for event_new_pot, the standalone pot, and the phase fund', () => {
    expect(outcomes.filter(outcomeCreatesNewPot)).toEqual(['event_new_pot', 'pot', 'pot_phase']);
  });

  it('marks ONLY pot_phase as a phase-scoped Pote/Fundo (E01/DEC-321)', () => {
    expect(outcomes.filter(outcomeCreatesPhasePot)).toEqual(['pot_phase']);
  });

  it('creates a purchase only for the two purchase outcomes', () => {
    expect(outcomes.filter(outcomeCreatesPurchase)).toEqual([
      'purchase_phase',
      'purchase_existing_pot',
    ]);
  });

  it('is funded by the phase (subtracts from the trecho) only for *_phase funding (NEVER the phase fund — it is à parte)', () => {
    expect(outcomes.filter(outcomeFundedByPhase)).toEqual(['event_phase', 'purchase_phase']);
  });

  it('every outcome creates exactly one primary item (event XOR purchase XOR a set-apart Pote/Fundo)', () => {
    for (const o of outcomes) {
      const primaries =
        Number(outcomeCreatesEvent(o)) +
        Number(outcomeCreatesPurchase(o)) +
        Number(o === 'pot' || o === 'pot_phase');
      expect(primaries).toBe(1);
    }
  });
});
