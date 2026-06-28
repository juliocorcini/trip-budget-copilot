import { describe, it, expect } from 'vitest';
import {
  eventAttributedSpent,
  isEventSessionExclusive,
  eventConsumedSpentCents,
  eventReserveRemainingCents,
  eventDaysLeftInclusive,
  eventDailyAllowanceCents,
  eventHasEnded,
  isEventLeftoverPending,
  selectPendingEventLeftovers,
} from '@/domain/budget';
import { createExpenseTransaction } from '@/domain/transactions';
import { createPlannedOccurrence } from '@/domain/planning';
import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

function mkEvent(overrides: Partial<PlannedOccurrence> = {}): PlannedOccurrence {
  return {
    ...createPlannedOccurrence({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Parral',
      plannedDate: '2026-06-12',
      endDate: null,
      kind: 'event',
      estimatedCostCents: 5000,
      reservedCents: 5000,
      activityProfileId: null,
    }),
    id: 'evt-1',
    ...overrides,
  };
}

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

describe('eventConsumedSpentCents (DEC-385 · G2)', () => {
  it('adds the attributed spend and the linked outing spend (disjoint draws)', () => {
    const occ = mkEvent({ id: 'evt-1', linkedSessionId: 'sess-1' });
    const txs = [
      mkExpense({ occurrenceId: 'evt-1', amountCents: 2000 }),
      mkExpense({ sessionId: 'sess-1', amountCents: 1500 }),
      mkExpense({ occurrenceId: 'evt-2', amountCents: 9999 }), // other event
      mkExpense({ sessionId: 'sess-2', amountCents: 8888 }), // other session
    ];
    expect(eventConsumedSpentCents(occ, txs)).toBe(3500);
  });

  it('counts only the attributed spend when the event has no linked session', () => {
    const occ = mkEvent({ id: 'evt-1', linkedSessionId: null });
    const txs = [
      mkExpense({ occurrenceId: 'evt-1', amountCents: 2000 }),
      mkExpense({ sessionId: 'sess-1', amountCents: 1500 }), // not this event's session
    ];
    expect(eventConsumedSpentCents(occ, txs)).toBe(2000);
  });
});

describe('eventReserveRemainingCents (DEC-385 · G2, keystone)', () => {
  it('is the full reserve while nothing is consumed (held, never released on start)', () => {
    expect(eventReserveRemainingCents(mkEvent({ linkedSessionId: 'sess-1' }), [])).toBe(5000);
  });

  it('shrinks by the consumed spend and floors at zero on overspend', () => {
    const occ = mkEvent({ id: 'evt-1' });
    expect(
      eventReserveRemainingCents(occ, [mkExpense({ occurrenceId: 'evt-1', amountCents: 2000 })]),
    ).toBe(3000);
    expect(
      eventReserveRemainingCents(occ, [mkExpense({ occurrenceId: 'evt-1', amountCents: 6000 })]),
    ).toBe(0);
  });

  it('reserves nothing for a resolved or track-only event', () => {
    expect(eventReserveRemainingCents(mkEvent({ isConfirmed: true }), [])).toBe(0);
    expect(eventReserveRemainingCents(mkEvent({ reservedCents: null }), [])).toBe(0);
  });
});

describe('eventDaysLeftInclusive (DEC-385 · G2)', () => {
  it('counts inclusively from today (or start) to the end of a multi-day event', () => {
    const occ = mkEvent({ plannedDate: '2026-06-12', endDate: '2026-06-15' });
    expect(eventDaysLeftInclusive(occ, '2026-06-10')).toBe(4); // before start → full span 12..15
    expect(eventDaysLeftInclusive(occ, '2026-06-13')).toBe(3); // mid → 13,14,15
    expect(eventDaysLeftInclusive(occ, '2026-06-15')).toBe(1); // last day
  });

  it('returns 1 for a single-day or already-elapsed event', () => {
    expect(eventDaysLeftInclusive(mkEvent({ endDate: null }), '2026-06-12')).toBe(1);
    expect(
      eventDaysLeftInclusive(mkEvent({ plannedDate: '2026-06-12', endDate: '2026-06-13' }), '2026-06-20'),
    ).toBe(1);
  });
});

describe('eventDailyAllowanceCents (DEC-385 · G2)', () => {
  it('splits the remaining reserve evenly over the days left and rolls slack forward', () => {
    const occ = mkEvent({ plannedDate: '2026-06-12', endDate: '2026-06-15', reservedCents: 4000 });
    // day 1 of 4, nothing spent → 4000 / 4 = 1000/day
    expect(eventDailyAllowanceCents(occ, [], '2026-06-12')).toBe(1000);
    // spent 600 on day 1, now day 2 of 3 left → (4000−600)/3 = 1133 (slack rolled)
    const txs = [mkExpense({ occurrenceId: 'evt-1', amountCents: 600 })];
    expect(eventDailyAllowanceCents(occ, txs, '2026-06-13')).toBe(1133);
  });

  it('is zero once the reserve is fully consumed', () => {
    const occ = mkEvent({ id: 'evt-1', reservedCents: 1000 });
    expect(
      eventDailyAllowanceCents(occ, [mkExpense({ occurrenceId: 'evt-1', amountCents: 1000 })], '2026-06-12'),
    ).toBe(0);
  });
});

describe('eventHasEnded (DEC-387 · G4)', () => {
  it('is true only once the end date is strictly before today (day-granular)', () => {
    const occ = mkEvent({ plannedDate: '2026-06-12', endDate: '2026-06-15' });
    expect(eventHasEnded(occ, '2026-06-15')).toBe(false); // last day is not "ended"
    expect(eventHasEnded(occ, '2026-06-16')).toBe(true);
    expect(eventHasEnded(occ, '2026-06-16T03:00:00.000Z')).toBe(true); // time ignored
  });

  it('uses the single plannedDate when there is no end date', () => {
    const occ = mkEvent({ plannedDate: '2026-06-12', endDate: null });
    expect(eventHasEnded(occ, '2026-06-12')).toBe(false);
    expect(eventHasEnded(occ, '2026-06-13')).toBe(true);
  });

  it('never ends a dateless event', () => {
    expect(eventHasEnded(mkEvent({ plannedDate: null, endDate: null }), '2026-12-31')).toBe(false);
  });
});

describe('isEventLeftoverPending (DEC-387 · G4)', () => {
  const ended = { plannedDate: '2026-06-10', endDate: '2026-06-12' };
  const today = '2026-06-20';

  it('is true for an ended event whose reserve still holds unspent money', () => {
    const occ = mkEvent({ id: 'evt-1', ...ended, reservedCents: 5000 });
    expect(isEventLeftoverPending(occ, [mkExpense({ occurrenceId: 'evt-1', amountCents: 2000 })], today)).toBe(
      true,
    );
  });

  it('is false while the event has not ended yet', () => {
    const occ = mkEvent({ id: 'evt-1', plannedDate: '2026-06-19', endDate: '2026-06-25', reservedCents: 5000 });
    expect(isEventLeftoverPending(occ, [], today)).toBe(false);
  });

  it('is false when the reserve is fully consumed (nothing left to resolve)', () => {
    const occ = mkEvent({ id: 'evt-1', ...ended, reservedCents: 5000 });
    expect(isEventLeftoverPending(occ, [mkExpense({ occurrenceId: 'evt-1', amountCents: 5000 })], today)).toBe(
      false,
    );
  });

  it('is false for an already-resolved, deleted, or track-only event', () => {
    expect(isEventLeftoverPending(mkEvent({ ...ended, isConfirmed: true }), [], today)).toBe(false);
    expect(isEventLeftoverPending(mkEvent({ ...ended, deletedAt: '2026-06-13T00:00:00.000Z' }), [], today)).toBe(
      false,
    );
    expect(isEventLeftoverPending(mkEvent({ ...ended, reservedCents: null }), [], today)).toBe(false);
  });

  it('is false for an occurrence that is not an event (e.g. a sub-destination)', () => {
    const occ = mkEvent({ id: 'evt-1', ...ended, kind: 'sub_destination', reservedCents: 5000 });
    expect(isEventLeftoverPending(occ, [], today)).toBe(false);
  });
});

describe('selectPendingEventLeftovers (DEC-387 · G4)', () => {
  const today = '2026-06-20';

  it('returns each pending leftover with its held amount, oldest-ended first', () => {
    const older = mkEvent({
      id: 'evt-old',
      plannedDate: '2026-06-08',
      endDate: '2026-06-09',
      reservedCents: 4000,
    });
    const newer = mkEvent({
      id: 'evt-new',
      plannedDate: '2026-06-14',
      endDate: '2026-06-15',
      reservedCents: 3000,
    });
    const txs = [
      mkExpense({ occurrenceId: 'evt-old', amountCents: 1000 }), // 4000−1000 = 3000 left
      mkExpense({ occurrenceId: 'evt-new', amountCents: 500 }), // 3000−500 = 2500 left
    ];
    // Passed newest-first to prove the sort orders by end date ascending.
    const result = selectPendingEventLeftovers([newer, older], txs, today);
    expect(result.map((r) => r.occurrence.id)).toEqual(['evt-old', 'evt-new']);
    expect(result.map((r) => r.leftoverCents)).toEqual([3000, 2500]);
  });

  it('excludes events that have not ended, are resolved, or are fully consumed', () => {
    const pending = mkEvent({ id: 'evt-1', plannedDate: '2026-06-10', endDate: '2026-06-11', reservedCents: 2000 });
    const future = mkEvent({ id: 'evt-2', plannedDate: '2026-06-25', endDate: '2026-06-26', reservedCents: 2000 });
    const resolved = mkEvent({
      id: 'evt-3',
      plannedDate: '2026-06-10',
      endDate: '2026-06-11',
      reservedCents: 2000,
      isConfirmed: true,
    });
    const result = selectPendingEventLeftovers([pending, future, resolved], [], today);
    expect(result.map((r) => r.occurrence.id)).toEqual(['evt-1']);
  });
});
