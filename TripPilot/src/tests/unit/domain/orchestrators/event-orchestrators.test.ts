import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  startSessionForOccurrence,
  startOneOffEventSession,
  endOutingSession,
  deleteEventKeepingExpenses,
  resolveEventLeftover,
} from '@/domain/orchestrators';
import { eventAttributedSpent, eventReserveRemainingCents, createBudgetPool } from '@/domain/budget';
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

  it('startSessionForOccurrence links the occurrence and HOLDS the reserve (DEC-385)', async () => {
    const occurrence = mkOccurrence();
    await db.plannedOccurrences.add(occurrence);

    // Before: €50 reserve deducts from freeToSpend.
    expect(calculateEventReserves([occurrence], 'phase-1', [])).toBe(5000);

    const session = mkSession();
    await startSessionForOccurrence({ session, occurrenceId: occurrence.id });

    const [storedSession, storedOcc] = await Promise.all([
      db.sessions.get(session.id),
      db.plannedOccurrences.get(occurrence.id),
    ]);
    expect(storedSession).toBeDefined();
    expect(storedOcc!.linkedSessionId).toBe(session.id);
    // DEC-385 keystone: linking no longer releases the reserve — it is HELD with
    // no spend yet (the phase "livre" must not jump on day 1)…
    expect(calculateEventReserves([storedOcc!], 'phase-1', [])).toBe(5000);

    // …and it is CONSUMED by the outing's spend: a €20 session expense shrinks
    // the still-reserved remainder to €30, never double counting.
    const sessionTx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 2000,
      currency: 'EUR',
      category: 'outing',
      description: 'Round',
      sessionId: session.id,
    });
    expect(calculateEventReserves([storedOcc!], 'phase-1', [sessionTx])).toBe(3000);
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
    // Confirmed/resolved → reserves nothing (leftover handled in G4); the €42
    // already lives in pool spent, so the event still weighs exactly once.
    expect(calculateEventReserves([storedOcc!], 'phase-1', [tx])).toBe(0);
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
    expect(calculateEventReserves(occurrences, 'phase-1', [])).toBe(0);
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

describe('resolveEventLeftover (DEC-387 · G4 — 3 destinations, money conserved 1:1)', () => {
  beforeEach(clearAll);

  async function seedEndedEventWithLeftover(poolTotalCents: number) {
    const pool = createBudgetPool({
      tripId: 'trip-1',
      name: 'Phase pool',
      scope: 'linked_phases',
      totalAmountCents: poolTotalCents,
      currency: 'EUR',
    });
    await db.budgetPools.add(pool);
    const occurrence = {
      ...mkOccurrence(),
      budgetPoolId: pool.id,
      plannedDate: '2026-06-10',
      endDate: '2026-06-12',
      reservedCents: 5000,
    };
    await db.plannedOccurrences.add(occurrence);
    return { pool, occurrence };
  }

  it('free: closes the reserve and releases the leftover back to free (no pool/envelope change)', async () => {
    const { occurrence } = await seedEndedEventWithLeftover(100000);

    // Held before: the €50 reserve still deducts from free.
    expect(eventReserveRemainingCents(occurrence, [])).toBe(5000);

    await resolveEventLeftover({
      occurrenceId: occurrence.id,
      amountCents: 5000,
      destination: 'free',
      leftoverLabel: 'Sobra de Parral',
      tripId: 'trip-1',
      currency: 'EUR',
    });

    const [storedOcc, envelopes, pools] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.envelopes.toArray(),
      db.budgetPools.toArray(),
    ]);
    expect(storedOcc!.isConfirmed).toBe(true);
    // Released: reserves nothing now, so the €50 returns to free-to-spend.
    expect(eventReserveRemainingCents(storedOcc!, [])).toBe(0);
    // No money re-homed: no envelope, the pool total is untouched.
    expect(envelopes).toHaveLength(0);
    expect(pools).toHaveLength(1);
    expect(pools[0]!.totalAmountCents).toBe(100000);
  });

  it('piggy: parks the leftover in a labeled protected_reserve on the same pool (net free unchanged)', async () => {
    const { pool, occurrence } = await seedEndedEventWithLeftover(100000);

    await resolveEventLeftover({
      occurrenceId: occurrence.id,
      amountCents: 5000,
      destination: 'piggy',
      leftoverLabel: 'Sobra de Parral',
      tripId: 'trip-1',
      currency: 'EUR',
    });

    const [storedOcc, envelopes, pools] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.envelopes.toArray(),
      db.budgetPools.toArray(),
    ]);
    expect(storedOcc!.isConfirmed).toBe(true);
    // The released €50 (reserve → 0) is exactly re-held as a labeled protected
    // reserve on the same pool: net free change is zero, money earmarked.
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]!.kind).toBe('protected_reserve');
    expect(envelopes[0]!.name).toBe('Sobra de Parral');
    expect(envelopes[0]!.amountCents).toBe(5000);
    expect(envelopes[0]!.budgetPoolId).toBe(pool.id);
    // Pool total is never touched by piggy.
    expect(pools[0]!.totalAmountCents).toBe(100000);
  });

  it('pot: moves the leftover into a dedicated global pot, preserving the trip total', async () => {
    const { pool, occurrence } = await seedEndedEventWithLeftover(100000);

    await resolveEventLeftover({
      occurrenceId: occurrence.id,
      amountCents: 5000,
      destination: 'pot',
      leftoverLabel: 'Sobra de Parral',
      tripId: 'trip-1',
      currency: 'EUR',
    });

    const [storedOcc, pools, envelopes] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.budgetPools.toArray(),
      db.envelopes.toArray(),
    ]);
    expect(storedOcc!.isConfirmed).toBe(true);
    expect(envelopes).toHaveLength(0);
    const source = pools.find((p) => p.id === pool.id)!;
    const pot = pools.find((p) => p.id !== pool.id)!;
    // Source pool ↓ €50, the new global pot ↑ €50 — the trip total is invariant.
    expect(source.totalAmountCents).toBe(95000);
    expect(pot.scope).toBe('global');
    expect(pot.name).toBe('Sobra de Parral');
    expect(pot.totalAmountCents).toBe(5000);
    expect(source.totalAmountCents + pot.totalAmountCents).toBe(100000);
  });

  it('still resolves (confirms) but moves nothing when the leftover is zero', async () => {
    const { occurrence } = await seedEndedEventWithLeftover(100000);

    await resolveEventLeftover({
      occurrenceId: occurrence.id,
      amountCents: 0,
      destination: 'pot',
      leftoverLabel: 'Sobra de Parral',
      tripId: 'trip-1',
      currency: 'EUR',
    });

    const [storedOcc, pools, envelopes] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.budgetPools.toArray(),
      db.envelopes.toArray(),
    ]);
    expect(storedOcc!.isConfirmed).toBe(true);
    expect(envelopes).toHaveLength(0);
    expect(pools).toHaveLength(1); // no pot created
    expect(pools[0]!.totalAmountCents).toBe(100000);
  });

  it('is a no-op for an already-deleted (tombstoned) event', async () => {
    const { occurrence } = await seedEndedEventWithLeftover(100000);
    await db.plannedOccurrences.update(occurrence.id, { deletedAt: '2026-06-13T00:00:00.000Z' });

    await resolveEventLeftover({
      occurrenceId: occurrence.id,
      amountCents: 5000,
      destination: 'pot',
      leftoverLabel: 'Sobra de Parral',
      tripId: 'trip-1',
      currency: 'EUR',
    });

    const [storedOcc, pools] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.budgetPools.toArray(),
    ]);
    // Untouched: not confirmed, no pot, pool total intact.
    expect(storedOcc!.isConfirmed).toBe(false);
    expect(pools).toHaveLength(1);
    expect(pools[0]!.totalAmountCents).toBe(100000);
  });
});
