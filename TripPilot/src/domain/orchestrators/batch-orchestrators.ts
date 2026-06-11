import { db } from '@/data/db/database';
import { markUpdated, softDelete } from '@/utils/entity-factory';

/**
 * DEC-118 (R-09): batch operations behind the list selection mode.
 * All deletions are SOFT (Core Rule 4) and each batch runs atomically.
 */

export async function softDeleteTransactionsBatch(transactionIds: string[]): Promise<void> {
  await db.transaction('rw', [db.transactions, db.participantShares], async () => {
    const transactions = await db.transactions.bulkGet(transactionIds);
    const found = transactions.filter((tx) => tx !== undefined);
    await db.transactions.bulkPut(found.map((tx) => softDelete(tx)));

    // Shares of a deleted expense disappear with it — no orphan debts.
    const shares = await db.participantShares
      .where('transactionId')
      .anyOf(transactionIds)
      .toArray();
    await db.participantShares.bulkPut(shares.map((share) => softDelete(share)));
  });
}

export async function moveTransactionsToPoolBatch(
  transactionIds: string[],
  budgetPoolId: string,
): Promise<void> {
  await db.transaction('rw', [db.transactions], async () => {
    const transactions = await db.transactions.bulkGet(transactionIds);
    const found = transactions.filter((tx) => tx !== undefined);
    await db.transactions.bulkPut(found.map((tx) => markUpdated({ ...tx, budgetPoolId })));
  });
}

export async function changeTransactionsCategoryBatch(
  transactionIds: string[],
  category: string,
): Promise<void> {
  await db.transaction('rw', [db.transactions], async () => {
    const transactions = await db.transactions.bulkGet(transactionIds);
    const found = transactions.filter((tx) => tx !== undefined);
    await db.transactions.bulkPut(found.map((tx) => markUpdated({ ...tx, category })));
  });
}

/**
 * Deleting an outing removes the session AND its expenses (the items ARE the
 * outing's money) — all soft, in one atomic batch.
 */
export async function softDeleteOutingSessionsBatch(sessionIds: string[]): Promise<void> {
  await db.transaction(
    'rw',
    [db.sessions, db.sessionItems, db.transactions, db.participantShares],
    async () => {
      const sessions = await db.sessions.bulkGet(sessionIds);
      const foundSessions = sessions.filter((s) => s !== undefined);
      await db.sessions.bulkPut(foundSessions.map((s) => softDelete(s)));

      const items = await db.sessionItems.where('sessionId').anyOf(sessionIds).toArray();
      await db.sessionItems.bulkPut(items.map((item) => softDelete(item)));

      const transactions = await db.transactions
        .where('sessionId')
        .anyOf(sessionIds)
        .toArray();
      const txIds = transactions.map((tx) => tx.id);
      await db.transactions.bulkPut(transactions.map((tx) => softDelete(tx)));

      if (txIds.length > 0) {
        const shares = await db.participantShares
          .where('transactionId')
          .anyOf(txIds)
          .toArray();
        await db.participantShares.bulkPut(shares.map((share) => softDelete(share)));
      }
    },
  );
}
