import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  startSessionForOccurrence,
  startOneOffEventSession,
  startEvent,
  startOutingForEvent,
  endEvent,
  endOutingSession,
  deleteEventKeepingExpenses,
  resolveEventLeftover,
} from '@/domain/orchestrators';
import {
  eventAttributedSpent,
  eventConsumedSpentCents,
  eventReserveRemainingCents,
  isEventLeftoverPending,
  createBudgetPool,
} from '@/domain/budget';
import { createPlannedOccurrence, isEventInProgress } from '@/domain/planning';
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

function mkSession(name = 'Parral', occurrenceId: string | null = null) {
  return createSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    activityProfileId: null,
    name,
    limits: { targetCents: 4000, ceilingCents: 5000, maxCents: 6500, avgDrinkPriceCents: null },
    quickAddValuesCents: [500, 1000],
    occurrenceId,
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

  it('DEC-400: ending an EVENT outing NEVER confirms/ends the event (Â-EVENT-LIFECYCLE)', async () => {
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

    const [storedOcc, storedSession] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.sessions.get(session.id),
    ]);
    // The OUTING is closed…
    expect(storedSession!.status).toBe('completed');
    // …but the EVENT survives — it is NOT confirmed and NOT ended (it only ends
    // via "encerrar evento"). The €8 unspent stays held, the €42 is in pool spent
    // exactly once: reserve = max(0, 5000 − 4200) = 800.
    expect(storedOcc!.isConfirmed).toBe(false);
    expect(storedOcc!.endedAt ?? null).toBeNull();
    expect(calculateEventReserves([storedOcc!], 'phase-1', [tx])).toBe(800);
  });

  it('endOutingSession STILL confirms a SUB-DESTINATION outing (DEC-072 preserved)', async () => {
    const subDest = { ...mkOccurrence(), kind: 'sub_destination' as const, name: 'Burgos' };
    await db.plannedOccurrences.add(subDest);
    const session = mkSession('Burgos');
    await startSessionForOccurrence({ session, occurrenceId: subDest.id });

    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 4200,
      currency: 'EUR',
      category: 'outing',
      description: 'Burgos',
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

    const storedOcc = await db.plannedOccurrences.get(subDest.id);
    expect(storedOcc!.isConfirmed).toBe(true);
    expect(storedOcc!.linkedTransactionId).toBe(tx.id);
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

describe('Event lifecycle — start → N outings → end (DEC-400 · G1, keystone)', () => {
  beforeEach(clearAll);

  it('startEvent marks the event started (live, never auto-disappears) without moving money', async () => {
    const occurrence = mkOccurrence();
    await db.plannedOccurrences.add(occurrence);

    await startEvent(occurrence.id);

    const stored = await db.plannedOccurrences.get(occurrence.id);
    expect(stored!.startedAt).not.toBeNull();
    expect(stored!.endedAt ?? null).toBeNull();
    expect(stored!.isConfirmed).toBe(false);
    // Live even on a day OUTSIDE its planned interval, because it was started.
    expect(isEventInProgress(stored!, '2999-01-01')).toBe(true);
    // The reserve is untouched (no spend yet).
    expect(eventReserveRemainingCents(stored!, [])).toBe(5000);
  });

  it('an event owns N outings (occurrenceId) — consumed sums ALL, no double count', async () => {
    const occurrence = mkOccurrence(); // €50 reserve
    await db.plannedOccurrences.add(occurrence);
    await startEvent(occurrence.id);

    // First outing: €15 spent.
    const out1 = mkSession('Round 1', occurrence.id);
    await startOutingForEvent({ session: out1, occurrenceId: occurrence.id });
    const tx1 = createExpenseTransaction({
      tripId: 'trip-1', phaseId: 'phase-1', budgetPoolId: 'pool-1', walletId: null,
      amountCents: 1500, currency: 'EUR', category: 'outing', description: 'R1', sessionId: out1.id,
    });
    await db.transactions.add(tx1);
    await endOutingSession({
      session: out1, transactions: [tx1], walletId: null, ownerParticipantId: null,
      isSpecialOccasion: false, excludeFromLearning: false, totalAdjustment: null, profile: null,
    });

    // Second outing: €10 spent. The first outing is closed; the event is STILL live.
    const occAfterOut1 = await db.plannedOccurrences.get(occurrence.id);
    expect(occAfterOut1!.isConfirmed).toBe(false);
    expect(isEventInProgress(occAfterOut1!, '2026-06-12')).toBe(true);

    const out2 = mkSession('Round 2', occurrence.id);
    await startOutingForEvent({ session: out2, occurrenceId: occurrence.id });
    const tx2 = createExpenseTransaction({
      tripId: 'trip-1', phaseId: 'phase-1', budgetPoolId: 'pool-1', walletId: null,
      amountCents: 1000, currency: 'EUR', category: 'outing', description: 'R2', sessionId: out2.id,
    });
    await db.transactions.add(tx2);

    // Plus one DIRECTLY attributed spend (occurrenceId) of €5 — disjoint draw.
    const txAttr = createExpenseTransaction({
      tripId: 'trip-1', phaseId: 'phase-1', budgetPoolId: 'pool-1', walletId: null,
      amountCents: 500, currency: 'EUR', category: 'bar', description: 'Direct', occurrenceId: occurrence.id,
    });
    await db.transactions.add(txAttr);

    const [storedOcc, sessions, txs] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.sessions.toArray(),
      db.transactions.toArray(),
    ]);
    // Consumed = €15 + €10 + €5 = €30, counted EXACTLY once across the 2 outings
    // + the attributed spend (Â-EVENT-NO-DOUBLE-COUNT).
    expect(eventConsumedSpentCents(storedOcc!, txs, sessions)).toBe(3000);
    // Reserve still held = max(0, 5000 − 3000) = 2000.
    expect(calculateEventReserves([storedOcc!], 'phase-1', txs, sessions)).toBe(2000);
  });

  it('endEvent closes the running outing, marks endedAt, and HOLDS the leftover (not confirmed)', async () => {
    const occurrence = mkOccurrence(); // €50 reserve
    await db.plannedOccurrences.add(occurrence);
    await startEvent(occurrence.id);

    const out = mkSession('Live round', occurrence.id);
    await startOutingForEvent({ session: out, occurrenceId: occurrence.id });
    const tx = createExpenseTransaction({
      tripId: 'trip-1', phaseId: 'phase-1', budgetPoolId: 'pool-1', walletId: null,
      amountCents: 2000, currency: 'EUR', category: 'outing', description: 'Live', sessionId: out.id,
    });
    await db.transactions.add(tx);

    await endEvent(occurrence.id);

    const [storedOcc, storedSession, sessions, txs] = await Promise.all([
      db.plannedOccurrences.get(occurrence.id),
      db.sessions.get(out.id),
      db.sessions.toArray(),
      db.transactions.toArray(),
    ]);
    // Running outing closed by the event end.
    expect(storedSession!.status).toBe('completed');
    // Event ended but NOT confirmed — the €30 leftover stays held (A4).
    expect(storedOcc!.endedAt).not.toBeNull();
    expect(storedOcc!.isConfirmed).toBe(false);
    expect(isEventInProgress(storedOcc!, '2026-06-12')).toBe(false);
    expect(eventReserveRemainingCents(storedOcc!, txs, sessions)).toBe(3000);
    // …and it now surfaces the leftover prompt (DEC-387) for the user to resolve.
    expect(isEventLeftoverPending(storedOcc!, txs, '2026-06-13', sessions)).toBe(true);
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
