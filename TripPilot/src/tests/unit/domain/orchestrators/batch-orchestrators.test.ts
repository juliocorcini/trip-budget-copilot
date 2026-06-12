import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  softDeleteTransactionsBatch,
  moveTransactionsToPoolBatch,
  changeTransactionsCategoryBatch,
  softDeleteOutingSessionsBatch,
  restoreTransactionsBatch,
  restoreOutingSessionsBatch,
  softDeleteSessionExpense,
} from '@/domain/orchestrators';
import { createExpenseTransaction } from '@/domain/transactions';
import { createSession, createSessionItem } from '@/domain/outing';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { ParticipantShare } from '@/domain/types/participant-share';

// DEC-118 (R-09): batch operations behind the list selection mode.

const mkTx = (amountCents: number, sessionId: string | null = null) =>
  createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'Item',
    sessionId,
    activityProfileId: null,
  });

const mkShare = (transactionId: string): ParticipantShare => ({
  ...createSyncMetadata(),
  transactionId,
  participantId: 'ana',
  shareAmountCents: 500,
  shareType: 'equal',
  isPaid: false,
  confirmationStatus: 'confirmed',
  notes: null,
});

const mkSession = () =>
  createSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    activityProfileId: null,
    name: 'Bar night',
    limits: { targetCents: 1500, ceilingCents: 2500, maxCents: 3500, avgDrinkPriceCents: null },
    quickAddValuesCents: [300],
  });

describe('batch orchestrators', () => {
  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.participantShares.clear(),
      db.sessions.clear(),
      db.sessionItems.clear(),
    ]);
  });

  it('soft-deletes transactions and their shares, leaving others intact', async () => {
    const tx1 = mkTx(1000);
    const tx2 = mkTx(2000);
    const tx3 = mkTx(3000);
    await db.transactions.bulkAdd([tx1, tx2, tx3]);
    await db.participantShares.bulkAdd([mkShare(tx1.id), mkShare(tx3.id)]);

    await softDeleteTransactionsBatch([tx1.id, tx2.id]);

    const stored = await db.transactions.toArray();
    expect(stored.find((t) => t.id === tx1.id)!.deletedAt).not.toBeNull();
    expect(stored.find((t) => t.id === tx2.id)!.deletedAt).not.toBeNull();
    expect(stored.find((t) => t.id === tx3.id)!.deletedAt).toBeNull();

    const shares = await db.participantShares.toArray();
    expect(shares.find((s) => s.transactionId === tx1.id)!.deletedAt).not.toBeNull();
    expect(shares.find((s) => s.transactionId === tx3.id)!.deletedAt).toBeNull();
  });

  it('moves transactions to another pool with a revision bump', async () => {
    const tx = mkTx(1000);
    await db.transactions.add(tx);

    await moveTransactionsToPoolBatch([tx.id], 'pool-2');

    const stored = await db.transactions.get(tx.id);
    expect(stored!.budgetPoolId).toBe('pool-2');
    expect(stored!.revision).toBe(tx.revision + 1);
  });

  it('changes the category of the selected transactions only', async () => {
    const tx1 = mkTx(1000);
    const tx2 = mkTx(2000);
    await db.transactions.bulkAdd([tx1, tx2]);

    await changeTransactionsCategoryBatch([tx1.id], 'restaurant');

    expect((await db.transactions.get(tx1.id))!.category).toBe('restaurant');
    expect((await db.transactions.get(tx2.id))!.category).toBe('bar');
  });

  it('deletes outings with their items, expenses and shares', async () => {
    const session = mkSession();
    await db.sessions.add(session);
    const tx1 = mkTx(900, session.id);
    const tx2 = mkTx(1100, session.id);
    const standalone = mkTx(500);
    await db.transactions.bulkAdd([tx1, tx2, standalone]);
    await db.sessionItems.bulkAdd([
      createSessionItem(session.id, tx1.id, 1),
      createSessionItem(session.id, tx2.id, 2),
    ]);
    await db.participantShares.add(mkShare(tx2.id));

    await softDeleteOutingSessionsBatch([session.id]);

    expect((await db.sessions.get(session.id))!.deletedAt).not.toBeNull();
    const items = await db.sessionItems.toArray();
    expect(items.every((item) => item.deletedAt !== null)).toBe(true);
    expect((await db.transactions.get(tx1.id))!.deletedAt).not.toBeNull();
    expect((await db.transactions.get(tx2.id))!.deletedAt).not.toBeNull();
    expect((await db.transactions.get(standalone.id))!.deletedAt).toBeNull();
    const shares = await db.participantShares.toArray();
    expect(shares[0]!.deletedAt).not.toBeNull();
  });

  // DEC-126: undo — restore twins of the soft deletes above.

  it('restores soft-deleted transactions with their shares (undo)', async () => {
    const tx1 = mkTx(1000);
    const tx2 = mkTx(2000);
    await db.transactions.bulkAdd([tx1, tx2]);
    await db.participantShares.add(mkShare(tx1.id));
    await softDeleteTransactionsBatch([tx1.id, tx2.id]);

    await restoreTransactionsBatch([tx1.id, tx2.id]);

    const stored = await db.transactions.toArray();
    expect(stored.every((t) => t.deletedAt === null)).toBe(true);
    const shares = await db.participantShares.toArray();
    expect(shares[0]!.deletedAt).toBeNull();
    // Restore is a real mutation: revision moves forward (delete +1, restore +1).
    expect(stored.find((t) => t.id === tx1.id)!.revision).toBe(tx1.revision + 2);
  });

  it('restores a deleted outing with its full cascade (undo)', async () => {
    const session = mkSession();
    await db.sessions.add(session);
    const tx1 = mkTx(900, session.id);
    const standalone = mkTx(500);
    await db.transactions.bulkAdd([tx1, standalone]);
    await db.sessionItems.add(createSessionItem(session.id, tx1.id, 1));
    await db.participantShares.add(mkShare(tx1.id));
    await softDeleteOutingSessionsBatch([session.id]);

    await restoreOutingSessionsBatch([session.id]);

    expect((await db.sessions.get(session.id))!.deletedAt).toBeNull();
    expect((await db.transactions.get(tx1.id))!.deletedAt).toBeNull();
    const items = await db.sessionItems.toArray();
    expect(items.every((item) => item.deletedAt === null)).toBe(true);
    const shares = await db.participantShares.toArray();
    expect(shares[0]!.deletedAt).toBeNull();
  });

  it('soft-deletes a single session expense, keeping the session (bar mode undo)', async () => {
    const session = mkSession();
    await db.sessions.add(session);
    const tx1 = mkTx(900, session.id);
    const tx2 = mkTx(1100, session.id);
    await db.transactions.bulkAdd([tx1, tx2]);
    await db.sessionItems.bulkAdd([
      createSessionItem(session.id, tx1.id, 1),
      createSessionItem(session.id, tx2.id, 2),
    ]);

    await softDeleteSessionExpense(tx1.id);

    expect((await db.sessions.get(session.id))!.deletedAt).toBeNull();
    expect((await db.transactions.get(tx1.id))!.deletedAt).not.toBeNull();
    expect((await db.transactions.get(tx2.id))!.deletedAt).toBeNull();
    const items = await db.sessionItems.toArray();
    expect(items.find((i) => i.transactionId === tx1.id)!.deletedAt).not.toBeNull();
    expect(items.find((i) => i.transactionId === tx2.id)!.deletedAt).toBeNull();
  });
});
