import { db } from '@/data/db/database';
import { markUpdated, softDelete, restoreDeleted } from '@/utils/entity-factory';

/**
 * DEC-118 (R-09): batch operations behind the list selection mode.
 * All deletions are SOFT (Core Rule 4) and each batch runs atomically.
 * DEC-126: every soft delete here has a restore twin powering the undo toast.
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

/**
 * DEC-126: undo for {@link softDeleteTransactionsBatch}. Shares are restored
 * together — in every flow they are only ever deleted WITH their transaction,
 * so clearing both deletedAt timestamps recovers the exact previous state.
 */
export async function restoreTransactionsBatch(transactionIds: string[]): Promise<void> {
  await db.transaction('rw', [db.transactions, db.participantShares], async () => {
    const transactions = await db.transactions.bulkGet(transactionIds);
    const found = transactions.filter((tx) => tx !== undefined);
    await db.transactions.bulkPut(found.map((tx) => restoreDeleted(tx)));

    const shares = await db.participantShares
      .where('transactionId')
      .anyOf(transactionIds)
      .toArray();
    await db.participantShares.bulkPut(shares.map((share) => restoreDeleted(share)));
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
 * Julio field feedback: move a batch of standalone expenses (e.g. Wise imports)
 * to another phase, carrying the phase's operational pool along. Phase + pool
 * travel TOGETHER (one dedicated pool per phase), so a misfiled import is fixed
 * in ONE action instead of item by item. The caller resolves the target phase's
 * pool (selectActivePhasePool) — this stays a thin, atomic persistence step.
 */
export async function moveTransactionsToPhaseBatch(
  transactionIds: string[],
  phaseId: string,
  budgetPoolId: string,
): Promise<void> {
  await db.transaction('rw', [db.transactions], async () => {
    const transactions = await db.transactions.bulkGet(transactionIds);
    const found = transactions.filter((tx) => tx !== undefined);
    await db.transactions.bulkPut(found.map((tx) => markUpdated({ ...tx, phaseId, budgetPoolId })));
  });
}

/**
 * Julio field feedback: move whole outings/receipts (sessions) to another phase
 * — the session AND every expense it holds move together to the target phase and
 * its operational pool. This is the "edit the imported note's phase/fund once,
 * for all items" path the field complaint asked for. Atomic.
 */
export async function moveOutingSessionsToPhaseBatch(
  sessionIds: string[],
  phaseId: string,
  budgetPoolId: string,
): Promise<void> {
  await db.transaction('rw', [db.sessions, db.transactions], async () => {
    const sessions = await db.sessions.bulkGet(sessionIds);
    const foundSessions = sessions.filter((s) => s !== undefined);
    await db.sessions.bulkPut(foundSessions.map((s) => markUpdated({ ...s, phaseId, budgetPoolId })));

    const transactions = await db.transactions.where('sessionId').anyOf(sessionIds).toArray();
    await db.transactions.bulkPut(
      transactions.map((tx) => markUpdated({ ...tx, phaseId, budgetPoolId })),
    );
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

/** DEC-126: undo for {@link softDeleteOutingSessionsBatch} — full cascade back. */
export async function restoreOutingSessionsBatch(sessionIds: string[]): Promise<void> {
  await db.transaction(
    'rw',
    [db.sessions, db.sessionItems, db.transactions, db.participantShares],
    async () => {
      const sessions = await db.sessions.bulkGet(sessionIds);
      const foundSessions = sessions.filter((s) => s !== undefined);
      await db.sessions.bulkPut(foundSessions.map((s) => restoreDeleted(s)));

      const items = await db.sessionItems.where('sessionId').anyOf(sessionIds).toArray();
      await db.sessionItems.bulkPut(items.map((item) => restoreDeleted(item)));

      const transactions = await db.transactions
        .where('sessionId')
        .anyOf(sessionIds)
        .toArray();
      const txIds = transactions.map((tx) => tx.id);
      await db.transactions.bulkPut(transactions.map((tx) => restoreDeleted(tx)));

      if (txIds.length > 0) {
        const shares = await db.participantShares
          .where('transactionId')
          .anyOf(txIds)
          .toArray();
        await db.participantShares.bulkPut(shares.map((share) => restoreDeleted(share)));
      }
    },
  );
}

/**
 * DEC-126/DEC-127: undo of a single in-session quick-add (Bar Mode has no
 * enrichment stepper, so a mistaken tap is reverted from the toast). The
 * session itself stays — only the expense and its links go.
 */
export async function softDeleteSessionExpense(transactionId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.sessionItems, db.participantShares],
    async () => {
      const tx = await db.transactions.get(transactionId);
      if (tx) await db.transactions.put(softDelete(tx));

      const items = await db.sessionItems
        .where('transactionId')
        .equals(transactionId)
        .toArray();
      await db.sessionItems.bulkPut(items.map((item) => softDelete(item)));

      const shares = await db.participantShares
        .where('transactionId')
        .equals(transactionId)
        .toArray();
      await db.participantShares.bulkPut(shares.map((share) => softDelete(share)));
    },
  );
}
