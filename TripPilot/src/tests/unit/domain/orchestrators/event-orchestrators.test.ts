import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  startSessionForOccurrence,
  startOneOffEventSession,
  endOutingSession,
  deleteEventKeepingExpenses,
} from '@/domain/orchestrators';
import { eventAttributedSpent } from '@/domain/budget';
import { createPlannedOccurrence } from '@/domain/planning';
import { createSession } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { calculateEventReserves } from '@/domain/budget';

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

function mkOccurrence() {
  return createPlannedOccurrence({
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
  });
}

function mkSession(name = 'Parral') {
  return createSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    activityProfileId: null,
    name,
    limits: { targetCents: 4000, ceilingCents: 5000, maxCents: 6500, avgDrinkPriceCents: null },
    quickAddValuesCents: [500, 1000],
  });
}

describe('Parral lifecycle (DEC-072/073 — FIELD-05 resolves FIELD-04)', () => {
  beforeEach(clearAll);

  it('startSessionForOccurrence links the occurrence and stops the reserve', async () => {
    const occurrence = mkOccurrence();
    await db.plannedOccurrences.add(occurrence);

    // Before: €50 reserve deducts from freeToSpend.
    expect(calculateEventReserves([occurrence], 'phase-1')).toBe(5000);

    const session = mkSession();
    await startSessionForOccurrence({ session, occurrenceId: occurrence.id });

    const [storedSession, storedOcc] = await Promise.all([
      db.sessions.get(session.id),
      db.plannedOccurrences.get(occurrence.id),
    ]);
    expect(storedSession).toBeDefined();
    expect(storedOcc!.linkedSessionId).toBe(session.id);
    // Linked → real spending takes over (Anchor Rule 10).
    expect(calculateEventReserves([storedOcc!], 'phase-1')).toBe(0);
  });

  it('endOutingSession confirms the linked occurrence', async () => {
    const occurrence = mkOccurrence();
    await db.plannedOccurrences.add(occurrence);
    const session = mkSession();
    await startSessionForOccurrence({ session, occurrenceId: occurrence.id });

    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 4200,
      currency: 'EUR',
      category: 'outing',
      description: 'Parral',
      sessionId: session.id,
    });
    await db.transactions.add(tx);

    await endOutingSession({
      session,
      transactions: [tx],
      walletId: null,
      ownerParticipantId: null,
      isSpecialOccasion: false,
      excludeFromLearning: false,
      totalAdjustment: null,
      profile: null,
    });

    const storedOcc = await db.plannedOccurrences.get(occurrence.id);
    expect(storedOcc!.isConfirmed).toBe(true);
    expect(storedOcc!.linkedTransactionId).toBe(tx.id);
    expect(calculateEventReserves([storedOcc!], 'phase-1')).toBe(0);
  });

  it('one-off custom session creates a linked occurrence, NEVER an ActivityProfile', async () => {
    const session = mkSession('Festa do hostel');
    const occurrence = createPlannedOccurrence({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Festa do hostel',
      plannedDate: '2026-06-12',
      endDate: null,
      kind: 'event',
      estimatedCostCents: 5000,
      reservedCents: null,
      activityProfileId: null,
    });

    await startOneOffEventSession({ session, occurrence });

    const [profiles, occurrences, storedSession] = await Promise.all([
      db.activityProfiles.toArray(),
      db.plannedOccurrences.toArray(),
      db.sessions.get(session.id),
    ]);
    expect(profiles).toHaveLength(0);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]!.linkedSessionId).toBe(session.id);
    expect(storedSession!.activityProfileId).toBeNull();
    // No reserve set → never deducts.
    expect(calculateEventReserves(occurrences, 'phase-1')).toBe(0);
  });

  it('deleteEventKeepingExpenses tombstones the event but KEEPS its expenses (DEC-386 · m4)', async () => {
    const occurrence = mkOccurrence();
    await db.plannedOccurrences.add(occurrence);

    const attributed = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 3000,
      currency: 'EUR',
      category: 'bar',
      description: 'From the event',
      occurrenceId: occurrence.id,
    });
    const unrelated = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 1000,
      currency: 'EUR',
      category: 'market',
      description: 'Unrelated',
    });
    await db.transactions.bulkAdd([attributed, unrelated]);

    await deleteEventKeepingExpenses(occurrence.id);

    const [storedOcc, storedAttr, storedUnrelated] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.transactions.get(attributed.id),
      db.transactions.get(unrelated.id),
    ]);
    // Event is tombstoned…
    expect(storedOcc!.deletedAt).not.toBeNull();
    // …but the expense survives, only the event link is cleared (A4).
    expect(storedAttr!.deletedAt).toBeNull();
    expect(storedAttr!.occurrenceId).toBeNull();
    // …and an unrelated expense is untouched.
    expect(storedUnrelated!.occurrenceId).toBeNull();
    // The reserve stops counting the deleted event's spend.
    expect(eventAttributedSpent(occurrence.id, [storedAttr!, storedUnrelated!])).toBe(0);
  });
});
