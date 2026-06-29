import { describe, it, expect } from 'vitest';
import {
  calculateFreeToSpend,
  calculatePoolSpent,
  eventAttributedSpent,
  eventConsumedSpentCents,
  buildLiveEventProgress,
} from '@/domain/budget';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';
import { createExpenseTransaction } from '@/domain/transactions';
import { createPlannedOccurrence } from '@/domain/planning';
import { createSession } from '@/domain/outing';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

/**
 * DEC-404 (G0) — two of Julio's twelve points are ALREADY correct in the code;
 * these are the proof tests (zero production code changes) that lock the
 * behaviour before the lifecycle work begins. The arithmetic of free-to-spend
 * and of the event reserve is INVARIANT for this whole wave (Â-MONEY-INVARIANT)
 * — these proofs are the baseline that invariance is measured against.
 */

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

const pool: BudgetPool = {
  ...meta,
  id: 'pool-1',
  tripId: 'trip-1',
  name: 'Main Fund',
  scope: 'linked_phases',
  totalAmountCents: 100000, // €1000 budget, no reserves
  currency: 'EUR',
  notes: null,
};

const links: BudgetPoolPhaseLink[] = [
  { ...meta, id: 'l1', budgetPoolId: 'pool-1', phaseId: 'phase-1', futureFloorCents: null },
];

function freeCents(transactions = [] as ReturnType<typeof createExpenseTransaction>[]): number {
  return calculateFreeToSpend(pool, [], transactions, links, 'phase-1', [], []).freeToSpendCents;
}

function mkEvent(overrides: Partial<PlannedOccurrence> = {}): PlannedOccurrence {
  return {
    ...createPlannedOccurrence({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Show',
      plannedDate: '2026-06-12',
      endDate: null,
      kind: 'event',
      estimatedCostCents: 10000,
      reservedCents: 10000,
      activityProfileId: null,
    }),
    id: 'evt-1',
    ...overrides,
  };
}

describe('DEC-404 · Point 1 — the event counts only MY part (split €30/3 → €10)', () => {
  // A €30 dinner split three ways, attributed to the event. My share is €10.
  const sharedDinner = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents: 3000, // €30 financial flow (the whole table)
    currency: 'EUR',
    category: 'food',
    description: 'Dinner (split 3 ways)',
    isShared: true,
    personalCostCents: 1000, // €10 — only my third
    occurrenceId: 'evt-1',
  });

  it('the spend contributes only my €10 personal cost, never the €30 flow', () => {
    expect(transactionBasePersonalCostCents(sharedDinner)).toBe(1000);
    expect(calculatePoolSpent([sharedDinner])).toBe(1000);
  });

  it('the event consumes only my €10 (eventAttributedSpent + eventConsumedSpentCents)', () => {
    const occ = mkEvent();
    expect(eventAttributedSpent('evt-1', [sharedDinner])).toBe(1000);
    expect(eventConsumedSpentCents(occ, [sharedDinner])).toBe(1000);
    // event share === pool share — the SAME rule, so no double count.
    expect(eventAttributedSpent('evt-1', [sharedDinner])).toBe(calculatePoolSpent([sharedDinner]));
  });

  it('the live-event view-model reports the consumed as €10 (not €30)', () => {
    const progress = buildLiveEventProgress(mkEvent(), [sharedDinner], '2026-06-12T12:00:00.000Z');
    expect(progress.consumedCents).toBe(1000);
    expect(progress.expenses).toHaveLength(1);
    expect(progress.expenses[0]?.baseCostCents).toBe(1000);
  });

  it('the held reserve shrinks by €10 (my part), not €30: €100 reserve → €90 left', () => {
    const occ = mkEvent({ reservedCents: 10000 });
    // remaining = max(0, 10000 − 1000) = 9000 (€90), proven via free-to-spend delta.
    const free = calculateFreeToSpend(pool, [], [sharedDinner], links, 'phase-1', [occ], []);
    // budget 100000 − spent 1000 − eventReserveRemaining 9000 = 90000.
    expect(free.totalSpentCents).toBe(1000);
    expect(free.eventReservesCents).toBe(9000);
    expect(free.freeToSpendCents).toBe(90000);
  });
});

describe('DEC-404 · Point 4 — what I owe (logged as a spend) already leaves free', () => {
  it('"someone paid €10 for me" drops free by exactly €10', () => {
    // Bruno fronted €10 that is entirely my cost — I owe my €10 share.
    const paidForMe = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 1000,
      currency: 'EUR',
      category: 'food',
      description: 'Bruno paid my snack',
      isShared: true,
      personalCostCents: 1000, // €10 — my debt
      paidByParticipantId: 'bruno', // someone else fronted the cash
    });
    const baseline = freeCents();
    const withDebt = freeCents([paidForMe]);
    expect(baseline).toBe(100000); // €1000, nothing spent yet
    expect(calculatePoolSpent([paidForMe])).toBe(1000);
    expect(baseline - withDebt).toBe(1000); // free fell by exactly my €10
    expect(withDebt).toBe(99000);
  });

  it('free falls by my personal cost regardless of who paid (invariant by payer)', () => {
    const common = {
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 3000, // €30 table
      currency: 'EUR',
      category: 'food',
      description: 'Round',
      isShared: true,
      personalCostCents: 1000, // €10 my share
    } as const;
    const iPaid = createExpenseTransaction({ ...common, paidByParticipantId: null });
    const friendPaid = createExpenseTransaction({ ...common, paidByParticipantId: 'bruno' });
    // The budget impact is the personal cost in BOTH cases — payer is irrelevant.
    expect(freeCents([iPaid])).toBe(99000);
    expect(freeCents([friendPaid])).toBe(99000);
  });
});

describe('DEC-400 (G1) — one event owns N outings: free nets the spend exactly ONCE', () => {
  const mkOuting = (name: string) =>
    createSession({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      activityProfileId: null,
      name,
      limits: { targetCents: 5000, ceilingCents: 6000, maxCents: 7000, avgDrinkPriceCents: null },
      quickAddValuesCents: [],
      occurrenceId: 'evt-1',
    });
  const out1 = mkOuting('Round 1');
  const out2 = mkOuting('Round 2');
  const sessions = [out1, out2];
  const tx1 = createExpenseTransaction({
    tripId: 'trip-1', phaseId: 'phase-1', budgetPoolId: 'pool-1', walletId: null,
    amountCents: 3000, currency: 'EUR', category: 'outing', description: 'R1', sessionId: out1.id,
  });
  const tx2 = createExpenseTransaction({
    tripId: 'trip-1', phaseId: 'phase-1', budgetPoolId: 'pool-1', walletId: null,
    amountCents: 2000, currency: 'EUR', category: 'outing', description: 'R2', sessionId: out2.id,
  });

  it('reserve held = €100 − (€30+€20) = €50; free falls by exactly €50 (Â-EVENT-NO-DOUBLE-COUNT)', () => {
    const occ = mkEvent({ reservedCents: 10000 });
    const free = calculateFreeToSpend(pool, [], [tx1, tx2], links, 'phase-1', [occ], [], sessions);
    expect(free.totalSpentCents).toBe(5000); // €50 in pool spent (once)
    expect(free.eventReservesCents).toBe(5000); // €50 reserve still held
    // €1000 − €50 spent − €50 held = €900, NOT €850 (which a double count gives).
    expect(free.freeToSpendCents).toBe(90000);
  });

  it('consumed sums both outings; the live view-model flags the running one', () => {
    const occ = mkEvent({ reservedCents: 10000 });
    expect(eventConsumedSpentCents(occ, [tx1, tx2], sessions)).toBe(5000);
    const progress = buildLiveEventProgress(
      occ,
      [tx1, tx2],
      '2026-06-12T12:00:00.000Z',
      [{ ...out1, status: 'completed' as const }, out2],
    );
    expect(progress.consumedCents).toBe(5000);
    expect(progress.expenses).toHaveLength(2);
    expect(progress.activeSessionId).toBe(out2.id); // out1 closed, out2 running
  });
});
