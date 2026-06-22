import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { discardOutingSession } from '@/domain/orchestrators';
import { createSession, createSessionItem, deriveSessionLimits } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { buildSharesWithPayer } from '@/domain/splitting';
import { createPlannedOccurrence } from '@/domain/planning';
import { createSyncMetadata } from '@/utils/entity-factory';
import { localDateString } from '@/domain/dates';
import type { ActivityProfile } from '@/domain/types/activity-profile';

const mkProfile = (overrides: Partial<ActivityProfile> = {}): ActivityProfile => ({
  ...createSyncMetadata(),
  tripId: 'trip-1',
  name: 'Bar',
  category: 'bar',
  iconName: null,
  color: null,
  typicalValueCents: 4000,
  safeValueCents: 5200,
  confidence: 'low',
  dataPointCount: 2,
  expectedFrequencyPerPhase: null,
  isCustom: false,
  defaultTargetCents: 3000,
  defaultCeilingCents: 5000,
  defaultMaxCents: 7000,
  defaultAvgDrinkPriceCents: 800,
  quickAddValuesCents: null,
  notes: null,
  ...overrides,
});

const mkSessionTx = (sessionId: string, amountCents: number, extra: Record<string, unknown> = {}) => ({
  ...createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'Round',
    sessionId,
    activityProfileId: null,
  }),
  ...extra,
});

async function seedSession(profileId: string | null = null) {
  const session = createSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    activityProfileId: profileId,
    name: 'Bar night',
    limits: deriveSessionLimits(mkProfile()),
    quickAddValuesCents: [300, 500],
  });
  await db.sessions.add(session);
  return session;
}

describe('discardOutingSession orchestrator (FB-23)', () => {
  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.sessions.clear(),
      db.sessionItems.clear(),
      db.participantShares.clear(),
      db.plannedOccurrences.clear(),
    ]);
  });

  it('soft-deletes the session, its expenses, shares and items (budget returns to prior state)', async () => {
    const session = await seedSession();

    const soloTx = mkSessionTx(session.id, 2000);
    const sharedTx = mkSessionTx(session.id, 3000, {
      isShared: true,
      paidByParticipantId: 'owner',
      personalCostCents: 1500,
    });
    await db.transactions.bulkAdd([soloTx, sharedTx]);

    const shares = buildSharesWithPayer({
      transactionId: sharedTx.id,
      amountCents: 3000,
      participantIds: ['owner', 'ana'],
      paidByParticipantId: 'owner',
      shareType: 'equal',
      customAmountsCents: {},
    });
    await db.participantShares.bulkAdd(shares);

    await db.sessionItems.bulkAdd([
      createSessionItem(session.id, soloTx.id, 1),
      createSessionItem(session.id, sharedTx.id, 2),
    ]);

    await discardOutingSession({ session });

    const storedSession = await db.sessions.get(session.id);
    expect(storedSession!.status).toBe('cancelled');
    expect(storedSession!.deletedAt).not.toBeNull();

    const liveTxs = (await db.transactions.toArray()).filter((t) => t.deletedAt === null);
    expect(liveTxs).toHaveLength(0);

    const liveShares = (await db.participantShares.toArray()).filter((s) => s.deletedAt === null);
    expect(liveShares).toHaveLength(0);

    const liveItems = (await db.sessionItems.toArray()).filter((it) => it.deletedAt === null);
    expect(liveItems).toHaveLength(0);
  });

  it('is reversible — every removed row is a soft delete (deletedAt set, not erased)', async () => {
    const session = await seedSession();
    const tx = mkSessionTx(session.id, 1800);
    await db.transactions.add(tx);
    await db.sessionItems.add(createSessionItem(session.id, tx.id, 1));

    await discardOutingSession({ session });

    // Rows still exist physically (soft delete keeps sync/undo consistent).
    expect(await db.transactions.count()).toBe(1);
    expect(await db.sessionItems.count()).toBe(1);
    expect(await db.sessions.count()).toBe(1);
    const storedTx = await db.transactions.get(tx.id);
    expect(storedTx!.deletedAt).not.toBeNull();
  });

  it('unlinks a pre-planned occurrence with a reserve so its reserve resumes (DEC-072)', async () => {
    const session = await seedSession();
    const planned = createPlannedOccurrence({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Concert',
      plannedDate: localDateString(new Date()),
      endDate: null,
      kind: 'event',
      estimatedCostCents: 6000,
      reservedCents: 6000,
      activityProfileId: null,
    });
    planned.linkedSessionId = session.id;
    await db.plannedOccurrences.add(planned);

    await discardOutingSession({ session });

    const stored = await db.plannedOccurrences.get(planned.id);
    expect(stored!.deletedAt).toBeNull();
    expect(stored!.linkedSessionId).toBeNull();
  });

  it('soft-deletes a one-off occurrence (no reserve) so it never leaks into the planner (DEC-073)', async () => {
    const session = await seedSession();
    const oneOff = createPlannedOccurrence({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Bar night',
      plannedDate: localDateString(new Date()),
      endDate: null,
      kind: 'event',
      estimatedCostCents: 5000,
      reservedCents: null,
      activityProfileId: null,
    });
    oneOff.linkedSessionId = session.id;
    await db.plannedOccurrences.add(oneOff);

    await discardOutingSession({ session });

    const stored = await db.plannedOccurrences.get(oneOff.id);
    expect(stored!.deletedAt).not.toBeNull();
  });

  it('leaves other sessions and their rows untouched', async () => {
    const session = await seedSession();
    const otherSession = await seedSession();
    const mine = mkSessionTx(session.id, 1000);
    const theirs = mkSessionTx(otherSession.id, 2000);
    await db.transactions.bulkAdd([mine, theirs]);

    await discardOutingSession({ session });

    const storedOther = await db.transactions.get(theirs.id);
    expect(storedOther!.deletedAt).toBeNull();
    const storedOtherSession = await db.sessions.get(otherSession.id);
    expect(storedOtherSession!.deletedAt).toBeNull();
    expect(storedOtherSession!.status).toBe('active');
  });
});
