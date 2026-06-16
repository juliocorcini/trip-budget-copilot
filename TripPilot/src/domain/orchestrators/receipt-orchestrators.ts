import { db } from '@/data/db/database';
import {
  createSession,
  createSessionItem,
  endSession,
  DEFAULT_QUICK_ADD_VALUES_CENTS,
} from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { resolvePayerExpense } from '@/domain/splitting';
import { softDelete } from '@/utils/entity-factory';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { ReceiptDraftItem } from '@/domain/receipt';

/** DEC-206 (G2): receipt-sourced records carry this externalRef prefix. */
const RECEIPT_REF_PREFIX = 'receipt:';

export interface CommitReceiptInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** Owner participant id (the user) — the split/debt anchor (DEC-114). */
  ownerId: string;
  currency: string;
  /** Session name — typically the merchant ("Mercadona BURGOS"). */
  name: string;
  /** Reviewed lines; only included ones with a positive amount are persisted. */
  items: ReceiptDraftItem[];
  /** Receipt photo to link to the created session, or null. */
  attachmentId: string | null;
}

export interface CommitReceiptResult {
  sessionId: string;
  transactionIds: string[];
}

/**
 * DEC-206 (G2): turns a reviewed receipt into a completed outing — one session
 * holding N expense items. A receipt is a PAST purchase, so the session is born
 * `completed` (it joins the outing history rather than becoming the active
 * session) as a one-off event (DEC-073: no recurring profile, zeroed limits so
 * the budget gauge/alerts ignore it).
 *
 * Each line becomes an expense. A line with participants is split equally via
 * resolvePayerExpense (DEC-114: registering = registering MY cost), so the
 * owner's share is born confirmed and the others' debts are tracked. Receipt
 * imports never feed the quick-value learning (`excludeFromLearning`). The whole
 * batch — session, items, transactions, shares and the photo link — is one Dexie
 * transaction: a crash commits all-or-nothing.
 */
export async function commitReceipt(input: CommitReceiptInput): Promise<CommitReceiptResult> {
  const lines = input.items.filter((item) => item.include && item.amountCents > 0);

  const session = endSession(
    createSession({
      tripId: input.tripId,
      phaseId: input.phaseId,
      budgetPoolId: input.budgetPoolId,
      activityProfileId: null,
      name: input.name,
      limits: { targetCents: 0, ceilingCents: 0, maxCents: 0, avgDrinkPriceCents: null },
      quickAddValuesCents: DEFAULT_QUICK_ADD_VALUES_CENTS,
    }),
  );

  const transactions: Transaction[] = [];
  const shares: ParticipantShare[] = [];

  lines.forEach((item, index) => {
    const tx = createExpenseTransaction({
      tripId: input.tripId,
      phaseId: input.phaseId,
      budgetPoolId: input.budgetPoolId,
      walletId: null,
      amountCents: item.amountCents,
      currency: input.currency,
      baseCurrencyAmountCents: item.amountCents,
      exchangeRate: null,
      category: item.category,
      description: item.description,
      sessionId: session.id,
      externalRef: `${RECEIPT_REF_PREFIX}${session.id}:${index}`,
      excludeFromLearning: true,
    });

    if (item.participantIds.length > 0) {
      const payerId = item.paidByParticipantId ?? input.ownerId;
      const resolution = resolvePayerExpense({
        transactionId: tx.id,
        amountCents: item.amountCents,
        ownerId: input.ownerId,
        payerId,
        didSplit: true,
        participantIds: item.participantIds,
        shareType: 'equal',
        customAmountsCents: {},
      });
      tx.isShared = resolution.isShared;
      tx.paidByParticipantId = payerId;
      tx.personalCostCents = resolution.personalCostCents;
      if (!resolution.movesOwnerWallet) tx.walletId = null;
      shares.push(...resolution.shares);
    }

    transactions.push(tx);
  });

  await db.transaction(
    'rw',
    [db.sessions, db.transactions, db.sessionItems, db.participantShares, db.attachments],
    async () => {
      await db.sessions.add(session);
      if (transactions.length > 0) {
        await db.transactions.bulkAdd(transactions);
        await db.sessionItems.bulkAdd(
          transactions.map((tx, index) => createSessionItem(session.id, tx.id, index + 1)),
        );
      }
      if (shares.length > 0) await db.participantShares.bulkAdd(shares);
      if (input.attachmentId !== null) {
        const attachment = await db.attachments.get(input.attachmentId);
        if (attachment !== undefined) {
          await db.attachments.put({ ...attachment, transactionId: null, sessionId: session.id });
        }
      }
    },
  );

  return { sessionId: session.id, transactionIds: transactions.map((tx) => tx.id) };
}

/**
 * Undo for {@link commitReceipt}: soft-deletes the session, its items, the
 * expense transactions and their shares — fully reversing the commit. The photo
 * attachment is left in place (harmless once its session is gone).
 */
export async function undoReceiptCommit(ids: {
  sessionId: string;
  transactionIds: string[];
}): Promise<void> {
  await db.transaction(
    'rw',
    [db.sessions, db.transactions, db.sessionItems, db.participantShares],
    async () => {
      if (ids.transactionIds.length > 0) {
        const txs = await db.transactions.bulkGet(ids.transactionIds);
        await db.transactions.bulkPut(
          txs.filter((t): t is Transaction => t !== undefined).map((t) => softDelete(t)),
        );
        const shares = await db.participantShares
          .where('transactionId')
          .anyOf(ids.transactionIds)
          .toArray();
        if (shares.length > 0) await db.participantShares.bulkPut(shares.map((s) => softDelete(s)));
      }
      const items = await db.sessionItems.where('sessionId').equals(ids.sessionId).toArray();
      if (items.length > 0) await db.sessionItems.bulkPut(items.map((it) => softDelete(it)));
      const session = await db.sessions.get(ids.sessionId);
      if (session !== undefined) await db.sessions.put(softDelete(session));
    },
  );
}
