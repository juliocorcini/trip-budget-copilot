import { db } from '@/data/db/database';
import {
  createSession,
  createSessionItem,
  endSession,
  DEFAULT_QUICK_ADD_VALUES_CENTS,
} from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { buildSplitCommitPlan, SPLIT_REF_PREFIX } from '@/domain/split';
import { resolveShareBirthStatus } from '@/domain/splitting';
import { convertToBaseCents } from '@/domain/money';
import { createSyncMetadata, softDelete } from '@/utils/entity-factory';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { SplitRecord } from '@/domain/types/split-record';
import type { SplitSession } from '@/domain/split';

export interface CommitSplitInput {
  /** The in-progress division (mode set, claims/tax/adjustments resolved). */
  session: SplitSession;
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** The trip owner Participant id — the split/debt anchor (DEC-114). */
  ownerParticipantId: string;
  /** Wallet the owner paid the whole bill from, or null. */
  walletId: string | null;
  /**
   * SplitParticipant.id → real trip Participant id, for the owner and any
   * promoted/linked guest (T5). The owner's SplitParticipant maps to
   * `ownerParticipantId` automatically. Ad-hoc people left out create no debt.
   */
  participantIdMap: Record<string, string>;
  /** Bill→base units per 1 bill unit; null when the bill is already in base. */
  exchangeRate: number | null;
  /** Receipt photo to link to the created session, or null. */
  attachmentId: string | null;
}

export interface CommitSplitResult {
  /** The created outing Session id (the navigable expense). */
  sessionId: string;
  transactionId: string;
  /** The SplitRecord id — equals the SplitSession id (stable across draft→commit). */
  splitRecordId: string;
}

function resolveRealIds(
  input: CommitSplitInput,
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const participant of input.session.participants) {
    if (participant.kind === 'owner') {
      map[participant.id] = input.ownerParticipantId;
    } else {
      map[participant.id] = input.participantIdMap[participant.id] ?? null;
    }
  }
  return map;
}

function toBaseCents(cents: number, exchangeRate: number | null): number {
  return exchangeRate === null ? cents : convertToBaseCents(cents, exchangeRate);
}

/**
 * Persists a bill split (T1). Generalizes {@link commitReceipt}: one completed
 * outing Session ("gasto dividido") holds a single expense for the whole bill,
 * with the owner's personal cost (the budget bridge) and custom participant
 * shares for every real participant — owner + non-connected people born confirmed
 * (DEC-071/114/241), only connected app users pending until they answer the
 * mirror. The readable item-level division (who took
 * what, tax, participants) is kept in the SplitRecord (`splitMeta`, T16) under
 * the SplitSession id, so opening the expense shows the whole split without
 * re-deriving it from transactions. E8: amounts are computed in the bill
 * currency and converted to the trip base for the budget. The whole batch is one
 * Dexie transaction (all-or-nothing).
 */
export async function commitSplit(input: CommitSplitInput): Promise<CommitSplitResult> {
  const realIdByParticipant = resolveRealIds(input);
  const plan = buildSplitCommitPlan(input.session, realIdByParticipant);

  // DEC-241 (DL-1): a slice is born confirmed (a real debt on the owner's
  // ledger) unless its participant is CONNECTED — an app user with an `actorId`
  // whose accept/reject rides the live mirror (DEC-071/106). Ad-hoc people just
  // promoted to a trip Participant have no `actorId`, so they owe immediately.
  const connectedRealIds = new Set<string>(
    input.session.participants
      .filter((participant) => participant.kind !== 'owner' && participant.actorId !== null)
      .map((participant) => realIdByParticipant[participant.id])
      .filter((realId): realId is string => realId !== null),
  );

  const session = endSession(
    createSession({
      tripId: input.tripId,
      phaseId: input.phaseId,
      budgetPoolId: input.budgetPoolId,
      activityProfileId: null,
      name: input.session.name,
      limits: { targetCents: 0, ceilingCents: 0, maxCents: 0, avgDrinkPriceCents: null },
      quickAddValuesCents: DEFAULT_QUICK_ADD_VALUES_CENTS,
    }),
  );

  const transaction = createExpenseTransaction({
    tripId: input.tripId,
    phaseId: input.phaseId,
    budgetPoolId: input.budgetPoolId,
    walletId: input.walletId,
    amountCents: plan.grandTotalCents,
    currency: input.session.currency,
    baseCurrencyAmountCents: toBaseCents(plan.grandTotalCents, input.exchangeRate),
    exchangeRate: input.exchangeRate,
    category: plan.category,
    description: input.session.name,
    sessionId: session.id,
    isShared: plan.hasDebtors,
    paidByParticipantId: input.ownerParticipantId,
    personalCostCents: plan.ownerCostCents,
    externalRef: `${SPLIT_REF_PREFIX}${input.session.id}`,
    excludeFromLearning: true,
  });

  const shares: ParticipantShare[] = plan.hasDebtors
    ? plan.shares.map((share) => ({
        ...createSyncMetadata(),
        transactionId: transaction.id,
        participantId: share.participantId,
        shareAmountCents: share.amountCents,
        shareType: 'custom' as const,
        isPaid: share.isOwner,
        confirmationStatus: resolveShareBirthStatus(share.participantId, share.isOwner, connectedRealIds),
        notes: null,
      }))
    : [];

  const sessionItem = createSessionItem(session.id, transaction.id, 1);

  const now = new Date().toISOString();
  const splitRecord: SplitRecord = {
    ...createSyncMetadata({ id: input.session.id }),
    tripId: input.tripId,
    sessionId: session.id,
    status: 'committed',
    splitMeta: { ...input.session, status: 'committed' },
    createdAt: input.session.createdAt ?? now,
  };

  await db.transaction(
    'rw',
    [db.sessions, db.transactions, db.sessionItems, db.participantShares, db.splitSessions, db.attachments],
    async () => {
      await db.sessions.add(session);
      await db.transactions.add(transaction);
      await db.sessionItems.add(sessionItem);
      if (shares.length > 0) await db.participantShares.bulkAdd(shares);
      await db.splitSessions.put(splitRecord);
      if (input.attachmentId !== null) {
        const attachment = await db.attachments.get(input.attachmentId);
        if (attachment !== undefined) {
          await db.attachments.put({ ...attachment, transactionId: null, sessionId: session.id });
        }
      }
    },
  );

  return { sessionId: session.id, transactionId: transaction.id, splitRecordId: splitRecord.id };
}

/**
 * Undo for {@link commitSplit}: soft-deletes the session, its item link, the
 * expense transaction and its shares, and reverts the SplitRecord to a `draft`
 * (clearing its link to the now-removed Session) so the division can be fixed
 * and re-committed. The photo attachment is left in place (harmless once its
 * session is gone), mirroring {@link undoReceiptCommit}.
 */
export async function undoSplitCommit(ids: {
  splitRecordId: string;
  sessionId: string;
  transactionId: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    [db.sessions, db.transactions, db.sessionItems, db.participantShares, db.splitSessions],
    async () => {
      const transaction = await db.transactions.get(ids.transactionId);
      if (transaction !== undefined) await db.transactions.put(softDelete(transaction));

      const shares = await db.participantShares
        .where('transactionId')
        .equals(ids.transactionId)
        .toArray();
      if (shares.length > 0) await db.participantShares.bulkPut(shares.map((s) => softDelete(s)));

      const items = await db.sessionItems.where('sessionId').equals(ids.sessionId).toArray();
      if (items.length > 0) await db.sessionItems.bulkPut(items.map((it) => softDelete(it)));

      const session = await db.sessions.get(ids.sessionId);
      if (session !== undefined) await db.sessions.put(softDelete(session));

      const record = await db.splitSessions.get(ids.splitRecordId);
      if (record !== undefined) {
        await db.splitSessions.put({
          ...record,
          status: 'draft',
          sessionId: null,
          splitMeta: { ...record.splitMeta, status: 'draft' },
          updatedAt: new Date().toISOString(),
          revision: record.revision + 1,
        });
      }
    },
  );
}
