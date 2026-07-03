import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  applyInboundDebtMove,
  revertInboundDebtMove,
  applyPendingDebtMove,
} from '@/domain/orchestrators';
import {
  transactionRepository,
  participantRepository,
  participantShareRepository,
  mailboxQueueRepository,
} from '@/data/repositories';
import { buildDebtMovePayload, externalRefForDebtMoveItem } from '@/domain/sync/debt-move-payload';
import { buildMailboxEnvelope } from '@/domain/sync/mailbox-envelope';
import { calculateDebts } from '@/domain/splitting';

/**
 * DEC-451 (D07) — the RECIPIENT device of a debt move, tested against the real
 * (fake-indexeddb) db with no network. This is the 2-device smoke of the gate:
 * the owner's `debt_move` envelope folds items into Bruno's ledger immediately
 * (payer = the mover, my confirmed share = the amount, provenance name on the
 * share), a redelivery is a no-op, and the owner's undo removes exactly what
 * the apply created (hide-never-delete).
 */
const MOVER_ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MOVE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-bruno',
};

/** Bruno's device: one active trip with a phase, a pool and himself as owner. */
async function seedActiveTrip(): Promise<void> {
  await db.table('trips').add({ ...meta, id: 'trip-b', name: 'Trip', baseCurrency: 'EUR', status: 'active' });
  await db.table('phases').add({ ...meta, id: 'phase-b', tripId: 'trip-b', name: 'P1', order: 0, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z' });
  await db.table('budgetPools').add({ ...meta, id: 'pool-b', tripId: 'trip-b', name: 'Fund', scope: 'general', totalAmountCents: 100000 });
  await db.table('participants').add({ ...meta, id: 'bruno', tripId: 'trip-b', name: 'Bruno', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null });
}

function movePayload(direction: 'apply' | 'revert' = 'apply') {
  return buildDebtMovePayload({
    moveId: MOVE_ID,
    direction,
    role: 'recipient',
    fromPersonName: 'Débora',
    toPersonName: 'Bruno',
    movedByName: 'Julio',
    currency: 'EUR',
    items: [
      { moveItemId: 'share-1', amountCents: 1200, description: 'Jantar', occurredAt: '2026-07-01T00:00:00.000Z' },
      { moveItemId: 'share-2', amountCents: 800, description: 'Uber', occurredAt: null },
    ],
  });
}

async function readLedger() {
  const transactions = (await transactionRepository.getByTripId('trip-b')).filter(
    (t) => t.deletedAt === null,
  );
  const shares = await participantShareRepository.getAllForTrip(transactions.map((t) => t.id));
  const participants = await participantRepository.getByTripId('trip-b');
  return { transactions, shares, participants };
}

describe('applyInboundDebtMove — immediate fold with provenance (DEC-451)', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('folds each moved item as a shared expense: mover paid, I owe, origin name on the share', async () => {
    await seedActiveTrip();
    const ok = await applyInboundDebtMove(movePayload(), MOVER_ACTOR, 'Julio');
    expect(ok).toBe(true);

    const { transactions, shares, participants } = await readLedger();
    expect(transactions).toHaveLength(2);

    // The mover materialized as a connected participant on Bruno's trip.
    const mover = participants.find((p) => p.linkedActorId === MOVER_ACTOR);
    expect(mover).toBeDefined();
    expect(mover!.name).toBe('Julio');

    // Every fold: payer = mover, single confirmed share on me, provenance carried.
    for (const tx of transactions) {
      expect(tx.paidByParticipantId).toBe(mover!.id);
      expect(tx.isShared).toBe(true);
      expect(tx.externalRef).toContain(MOVE_ID);
      const txShares = shares.filter((s) => s.transactionId === tx.id);
      expect(txShares).toHaveLength(1);
      expect(txShares[0]!.participantId).toBe('bruno');
      expect(txShares[0]!.confirmationStatus).toBe('confirmed');
      expect(txShares[0]!.reassignedFromName).toBe('Débora');
    }

    // The math lands: I owe the mover exactly €20.00.
    const summary = calculateDebts(transactions, shares, participants, [], 'bruno');
    const mine = summary.debts.find((d) => d.debtorId === 'bruno' && d.creditorId === mover!.id);
    expect(mine?.amountCents).toBe(2000);
  });

  it('a redelivered envelope is a no-op (per-item externalRef idempotency)', async () => {
    await seedActiveTrip();
    await applyInboundDebtMove(movePayload(), MOVER_ACTOR, 'Julio');
    await applyInboundDebtMove(movePayload(), MOVER_ACTOR, 'Julio');

    const { transactions } = await readLedger();
    expect(transactions).toHaveLength(2); // still 2, not 4
    const ref = externalRefForDebtMoveItem(MOVER_ACTOR, MOVE_ID, 'share-1');
    expect(transactions.filter((t) => t.externalRef === ref)).toHaveLength(1);
  });

  it('returns false (keeps the payload queued) when no active trip exists yet', async () => {
    const ok = await applyInboundDebtMove(movePayload(), MOVER_ACTOR, 'Julio');
    expect(ok).toBe(false);
  });
});

describe('revertInboundDebtMove — the owner undo propagates (DEC-451)', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('soft-deletes exactly the transactions the apply created, and only those', async () => {
    await seedActiveTrip();
    // An unrelated expense that must survive the revert.
    await db.table('transactions').add({
      ...meta, id: 'tx-own', tripId: 'trip-b', phaseId: 'phase-b', budgetPoolId: 'pool-b',
      walletId: null, sessionId: null, type: 'expense', amountCents: 5000, personalCostCents: null,
      currency: 'EUR', baseCurrencyAmountCents: 5000, exchangeRate: null, category: 'bar',
      subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null,
      description: 'my own beer', date: '2026-07-01T00:00:00.000Z', isShared: false,
      paidByParticipantId: null, activityProfileId: null, isSpecialOccasion: false,
      excludeFromLearning: false, sourceWalletId: null, targetWalletId: null,
      settlementId: null, adjustmentReason: null, notes: null, externalRef: null,
    });
    await applyInboundDebtMove(movePayload(), MOVER_ACTOR, 'Julio');
    expect((await readLedger()).transactions).toHaveLength(3);

    const reverted = await revertInboundDebtMove({ moveId: MOVE_ID }, MOVER_ACTOR);
    expect(reverted).toBe(2);

    const { transactions } = await readLedger();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.id).toBe('tx-own');

    // Idempotent: a second revert finds nothing.
    expect(await revertInboundDebtMove({ moveId: MOVE_ID }, MOVER_ACTOR)).toBe(0);
  });

  it('drops any still-pending inbox card for the same move', async () => {
    await seedActiveTrip();
    const payload = movePayload();
    const envelope = buildMailboxEnvelope({ kind: 'debt_move', fromActorId: MOVER_ACTOR, fromName: 'Julio', data: payload });
    await mailboxQueueRepository.enqueueIn({ kind: 'debt_move', fromActorId: MOVER_ACTOR, fromName: 'Julio', envelope });
    expect(await mailboxQueueRepository.pendingInbox()).toHaveLength(1);

    await revertInboundDebtMove({ moveId: MOVE_ID }, MOVER_ACTOR);
    expect(await mailboxQueueRepository.pendingInbox()).toHaveLength(0);
  });
});

describe('applyPendingDebtMove — manual apply after the notebook exists (DEC-451)', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('applies a queued move once a trip exists and swaps the card for its applied version', async () => {
    // The move arrived with NO trip: the drain would keep it actionable.
    const payload = movePayload();
    const envelope = buildMailboxEnvelope({ kind: 'debt_move', fromActorId: MOVER_ACTOR, fromName: 'Julio', data: payload });
    const item = await mailboxQueueRepository.enqueueIn({ kind: 'debt_move', fromActorId: MOVER_ACTOR, fromName: 'Julio', envelope });

    expect(await applyPendingDebtMove(item.id)).toBe(false); // still no trip

    await seedActiveTrip();
    expect(await applyPendingDebtMove(item.id)).toBe(true);

    const { transactions } = await readLedger();
    expect(transactions).toHaveLength(2);

    // The card still exists (visible, Â-MOVE-VISIBLE-BOTH-SIDES) but is now informative.
    const pending = await mailboxQueueRepository.pendingInbox();
    expect(pending).toHaveLength(1);
    expect((pending[0]!.envelope!.data as { appliedAt?: string }).appliedAt).toBeTruthy();
  });
});
