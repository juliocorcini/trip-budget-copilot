import { describe, it, expect } from 'vitest';
import { planGuestSelfExpense, type PlanGuestSelfExpenseInput } from '@/domain/split';

function baseInput(overrides: Partial<PlanGuestSelfExpenseInput> = {}): PlanGuestSelfExpenseInput {
  return {
    myTotalCents: 1280,
    sessionCurrency: 'EUR',
    sessionName: 'Jantar no Tasca',
    category: 'restaurant',
    hasTrip: true,
    tripBaseCurrency: 'EUR',
    activePhaseId: 'phase-1',
    primaryPoolId: 'pool-1',
    committedTxId: null,
    ...overrides,
  };
}

describe('planGuestSelfExpense (F9)', () => {
  it('returns "none" when the guest has no positive slice', () => {
    expect(planGuestSelfExpense(baseInput({ myTotalCents: 0 })).kind).toBe('none');
    expect(planGuestSelfExpense(baseInput({ myTotalCents: -50 })).kind).toBe('none');
  });

  it('returns "no_trip" for a true stranger (no app)', () => {
    const plan = planGuestSelfExpense(
      baseInput({ hasTrip: false, tripBaseCurrency: null, activePhaseId: null, primaryPoolId: null }),
    );
    expect(plan.kind).toBe('no_trip');
  });

  it('returns "already" (idempotent) when this table was committed before', () => {
    const plan = planGuestSelfExpense(baseInput({ committedTxId: 'tx-existing' }));
    expect(plan).toEqual({ kind: 'already', txId: 'tx-existing' });
  });

  it('"already" wins over everything once a commit exists', () => {
    // Even a stranger-looking input is short-circuited by an existing commit.
    const plan = planGuestSelfExpense(
      baseInput({ committedTxId: 'tx-1', hasTrip: false, myTotalCents: 999 }),
    );
    expect(plan).toEqual({ kind: 'already', txId: 'tx-1' });
  });

  it('returns "ready" with phase + pool for a same-currency app user', () => {
    const plan = planGuestSelfExpense(baseInput());
    expect(plan).toEqual({
      kind: 'ready',
      amountCents: 1280,
      currency: 'EUR',
      category: 'restaurant',
      description: 'Jantar no Tasca',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
    });
  });

  it('rounds a fractional slice to whole cents', () => {
    const plan = planGuestSelfExpense(baseInput({ myTotalCents: 426.6 }));
    expect(plan.kind === 'ready' && plan.amountCents).toBe(427);
  });

  it('falls back to a non-empty description when the session is unnamed', () => {
    const plan = planGuestSelfExpense(baseInput({ sessionName: '   ' }));
    expect(plan.kind === 'ready' && plan.description).toBe('Split');
  });

  it('hands off to the full editor when the table currency differs from the base', () => {
    const plan = planGuestSelfExpense(baseInput({ tripBaseCurrency: 'BRL', sessionCurrency: 'EUR' }));
    expect(plan).toEqual({
      kind: 'currency_mismatch',
      amountCents: 1280,
      currency: 'EUR',
      category: 'restaurant',
      description: 'Jantar no Tasca',
    });
  });

  it('hides the CTA ("none") for a broken trip with no active phase/pool', () => {
    expect(planGuestSelfExpense(baseInput({ activePhaseId: null })).kind).toBe('none');
    expect(planGuestSelfExpense(baseInput({ primaryPoolId: null })).kind).toBe('none');
  });
});
