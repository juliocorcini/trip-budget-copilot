import { describe, it, expect } from 'vitest';
import { eventAttributedSpent, isEventSessionExclusive } from '@/domain/budget';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Transaction } from '@/domain/types/transaction';

function mkExpense(overrides: Partial<Parameters<typeof createExpenseTransaction>[0]> = {}): Transaction {
  return createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: 'w1',
    amountCents: 1000,
    currency: 'EUR',
    category: 'bar',
    description: 'Spend',
    ...overrides,
  });
}

describe('eventAttributedSpent (DEC-386 · G1)', () => {
  it('sums only the live expenses attributed to the given event', () => {
    const txs = [
      mkExpense({ occurrenceId: 'evt-1', amountCents: 1500 }),
      mkExpense({ occurrenceId: 'evt-1', amountCents: 2500 }),
      mkExpense({ occurrenceId: 'evt-2', amountCents: 9999 }), // other event
      mkExpense({ amountCents: 7777 }), // no event
    ];
    expect(eventAttributedSpent('evt-1', txs)).toBe(4000);
  });

  it('ignores soft-deleted attributed expenses', () => {
    const live = mkExpense({ occurrenceId: 'evt-1', amountCents: 3000 });
    const dead: Transaction = {
      ...mkExpense({ occurrenceId: 'evt-1', amountCents: 5000 }),
      deletedAt: '2026-06-12T00:00:00.000Z',
    };
    expect(eventAttributedSpent('evt-1', [live, dead])).toBe(3000);
  });

  it('uses the base-currency personal cost for a foreign-currency spend', () => {
    // 1000 CZK cents × 0.04 = 40 base cents (same rule as calculatePoolSpent).
    const foreign = mkExpense({
      occurrenceId: 'evt-1',
      amountCents: 1000,
      currency: 'CZK',
      exchangeRate: 0.04,
      baseCurrencyAmountCents: 40,
    });
    expect(eventAttributedSpent('evt-1', [foreign])).toBe(40);
  });

  it('counts an adjustment attributed to the event but never an income/transfer', () => {
    const expense = mkExpense({ occurrenceId: 'evt-1', amountCents: 1000 });
    const adjustment: Transaction = {
      ...mkExpense({ occurrenceId: 'evt-1', amountCents: 500 }),
      type: 'adjustment',
    };
    const income: Transaction = {
      ...mkExpense({ occurrenceId: 'evt-1', amountCents: 9999 }),
      type: 'income',
    };
    expect(eventAttributedSpent('evt-1', [expense, adjustment, income])).toBe(1500);
  });

  it('is zero when nothing is attributed', () => {
    expect(eventAttributedSpent('evt-1', [mkExpense({ amountCents: 1000 })])).toBe(0);
    expect(eventAttributedSpent('evt-1', [])).toBe(0);
  });
});

describe('isEventSessionExclusive (Â-ATTRIBUTION · event XOR session)', () => {
  it('is false only when BOTH an event and a session are set', () => {
    expect(isEventSessionExclusive({ occurrenceId: 'evt-1', sessionId: 'sess-1' })).toBe(false);
  });

  it('is true when at most one link is set', () => {
    expect(isEventSessionExclusive({ occurrenceId: 'evt-1', sessionId: null })).toBe(true);
    expect(isEventSessionExclusive({ occurrenceId: null, sessionId: 'sess-1' })).toBe(true);
    expect(isEventSessionExclusive({ occurrenceId: null, sessionId: null })).toBe(true);
  });

  it('treats undefined (legacy records) as "not set"', () => {
    expect(isEventSessionExclusive({ occurrenceId: undefined, sessionId: 'sess-1' })).toBe(true);
    expect(isEventSessionExclusive({ occurrenceId: 'evt-1', sessionId: undefined })).toBe(true);
    expect(isEventSessionExclusive({ occurrenceId: undefined, sessionId: undefined })).toBe(true);
  });
});
