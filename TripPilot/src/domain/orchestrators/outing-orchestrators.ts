import { db } from '@/data/db/database';
import { endSession, createSessionItem } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { updateProfileFromTransaction } from '@/domain/forecasting';
import { isPaidByOwner, resolvePayerExpense } from '@/domain/splitting';
import { markUpdated, softDelete } from '@/utils/entity-factory';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

export interface EndOutingSessionInput {
  session: Session;
  /** Final session items (amount/description edits already applied by the review UI). */
  transactions: Transaction[];
  /** Batch wallet assignment — applied to items still without a wallet (DEC-049). */
  walletId: string | null;
  /** DEC-114: items paid by someone else NEVER receive the batch wallet. */
  ownerParticipantId: string | null;
  isSpecialOccasion: boolean;
  excludeFromLearning: boolean;
  /** Optional "reported total" adjustment built by the review (DEC-046). */
  totalAdjustment: Transaction | null;
  profile: ActivityProfile | null;
}

export interface EndOutingSessionResult {
  session: Session;
  updatedProfile: ActivityProfile | null;
}

/**
 * DEC-049 end-of-session review, applied atomically (D-H / GAP-030):
 * batch wallet → classification flags → optional cash adjustment →
 * profile learning (DEC-006) → session completed.
 */
export async function endOutingSession(
  input: EndOutingSessionInput,
): Promise<EndOutingSessionResult> {
  const finalTransactions = input.transactions
    .filter((tx) => tx.deletedAt === null)
    .map((tx) =>
      markUpdated({
        ...tx,
        // DEC-114: someone else paid → my wallet was never moved, so the
        // batch wallet must not be assigned to that item.
        walletId: isPaidByOwner(tx, input.ownerParticipantId)
          ? (tx.walletId ?? input.walletId)
          : tx.walletId,
        isSpecialOccasion: input.isSpecialOccasion,
        excludeFromLearning: input.excludeFromLearning,
      }),
    );

  // DEC-006: special occasions and excluded sessions never teach the profile.
  let updatedProfile: ActivityProfile | null = null;
  if (input.profile && !input.excludeFromLearning && !input.isSpecialOccasion) {
    let working = input.profile;
    for (const tx of finalTransactions.filter((t) => t.type === 'expense')) {
      const learning = updateProfileFromTransaction(
        working,
        tx.personalCostCents ?? tx.amountCents,
        false,
      );
      working = { ...working, ...learning };
    }
    updatedProfile = markUpdated(working);
  }

  const completedSession = markUpdated(endSession(input.session));

  await db.transaction(
    'rw',
    [db.transactions, db.sessions, db.activityProfiles, db.plannedOccurrences],
    async () => {
      await db.transactions.bulkPut(finalTransactions);
      if (input.totalAdjustment) {
        await db.transactions.add({
          ...input.totalAdjustment,
          walletId: input.totalAdjustment.walletId ?? input.walletId,
          isSpecialOccasion: input.isSpecialOccasion,
          excludeFromLearning: true,
        });
      }
      if (updatedProfile) {
        await db.activityProfiles.put(updatedProfile);
      }
      await db.sessions.put(completedSession);

      // DEC-072 (M6.4): a session linked to a planned event confirms the
      // occurrence — its reserve stops deducting and real spending takes over.
      const occurrence = await db.plannedOccurrences
        .filter((o) => o.linkedSessionId === input.session.id && o.deletedAt === null)
        .first();
      if (occurrence && !occurrence.isConfirmed) {
        await db.plannedOccurrences.put(
          markUpdated({
            ...occurrence,
            isConfirmed: true,
            linkedTransactionId: finalTransactions[0]?.id ?? null,
          }),
        );
      }
    },
  );

  return { session: completedSession, updatedProfile };
}

export interface DiscardOutingSessionInput {
  session: Session;
}

/**
 * FB-23 (DEC-282): end an outing WITHOUT saving it. Every row is soft-deleted
 * (reversible, sync/undo-consistent — never a hard delete) so the budget
 * returns to the exact state before the outing started: the session's expenses,
 * their participant shares and its session items go, and the session itself is
 * marked `cancelled` + soft-deleted (so it shows up neither in the active slot
 * nor in the history). A linked occurrence is reconciled by reserve presence
 * (DEC-072): a planned event with a reserve is just UNLINKED so its reserve
 * resumes and it stays in the planner; a one-off event session's occurrence
 * (DEC-073, no reserve, created only to back this session) is soft-deleted so
 * it never leaks into the planner. All applied atomically.
 */
export async function discardOutingSession(
  input: DiscardOutingSessionInput,
): Promise<void> {
  const { session } = input;
  await db.transaction(
    'rw',
    [db.sessions, db.transactions, db.sessionItems, db.participantShares, db.plannedOccurrences],
    async () => {
      const sessionTxs = await db.transactions.where('sessionId').equals(session.id).toArray();
      const liveTxs = sessionTxs.filter((tx) => tx.deletedAt === null);
      if (liveTxs.length > 0) {
        await db.transactions.bulkPut(liveTxs.map((tx) => softDelete(tx)));
        const txIds = liveTxs.map((tx) => tx.id);
        const shares = await db.participantShares.where('transactionId').anyOf(txIds).toArray();
        const liveShares = shares.filter((s) => s.deletedAt === null);
        if (liveShares.length > 0) {
          await db.participantShares.bulkPut(liveShares.map((s) => softDelete(s)));
        }
      }

      const items = await db.sessionItems.where('sessionId').equals(session.id).toArray();
      const liveItems = items.filter((it) => it.deletedAt === null);
      if (liveItems.length > 0) {
        await db.sessionItems.bulkPut(liveItems.map((it) => softDelete(it)));
      }

      const occurrences = await db.plannedOccurrences
        .filter((o) => o.linkedSessionId === session.id && o.deletedAt === null)
        .toArray();
      for (const occurrence of occurrences) {
        if (occurrence.reservedCents === null) {
          // One-off scaffolding (DEC-073): existed only for this session.
          await db.plannedOccurrences.put(softDelete(occurrence));
        } else {
          // Pre-planned reserve (DEC-072): unlink so the reserve resumes.
          await db.plannedOccurrences.put(markUpdated({ ...occurrence, linkedSessionId: null }));
        }
      }

      await db.sessions.put(softDelete({ ...session, status: 'cancelled' as const }));
    },
  );
}

export interface StartSessionForOccurrenceInput {
  session: Session;
  occurrenceId: string;
}

/**
 * DEC-072 (M6.3): "Start now" on the day card creates the outing session and
 * links the occurrence atomically — the link stops the reserve deduction.
 */
export async function startSessionForOccurrence(
  input: StartSessionForOccurrenceInput,
): Promise<void> {
  await db.transaction('rw', [db.sessions, db.plannedOccurrences], async () => {
    await db.sessions.add(input.session);
    const occurrence = await db.plannedOccurrences.get(input.occurrenceId);
    if (occurrence && occurrence.deletedAt === null) {
      await db.plannedOccurrences.put(
        markUpdated({ ...occurrence, linkedSessionId: input.session.id }),
      );
    }
  });
}

export interface StartOneOffEventSessionInput {
  session: Session;
  /** Freshly built (not yet persisted) occurrence for the one-off event. */
  occurrence: PlannedOccurrence;
}

/**
 * DEC-073 (M6.5 / FIELD-04): a one-off custom session creates a linked
 * PlannedOccurrence instead of an ActivityProfile — no Planner/Profiles
 * contamination.
 */
export async function startOneOffEventSession(
  input: StartOneOffEventSessionInput,
): Promise<void> {
  await db.transaction('rw', [db.sessions, db.plannedOccurrences], async () => {
    await db.sessions.add(input.session);
    await db.plannedOccurrences.add({ ...input.occurrence, linkedSessionId: input.session.id });
  });
}

/**
 * DEC-386 (G1 · m4): delete (tombstone) a planned event and KEEP every expense
 * attributed to it — only the event link is cleared (A4 hide-never-delete). The
 * spends stay in the ledger as ordinary phase expenses (`occurrenceId → null`),
 * so no money moves and the consumable reserve (DEC-385) simply stops counting a
 * deleted event. `occurrenceId` is NOT indexed, so the attributed rows are found
 * with a table `filter` (a one-off delete action, not a hot path). Atomic.
 */
export async function deleteEventKeepingExpenses(occurrenceId: string): Promise<void> {
  await db.transaction('rw', [db.plannedOccurrences, db.transactions], async () => {
    const occurrence = await db.plannedOccurrences.get(occurrenceId);
    if (occurrence && occurrence.deletedAt === null) {
      await db.plannedOccurrences.put(softDelete(occurrence));
    }
    const attributed = await db.transactions
      .filter((tx) => tx.occurrenceId === occurrenceId && tx.deletedAt === null)
      .toArray();
    for (const tx of attributed) {
      await db.transactions.put(markUpdated({ ...tx, occurrenceId: null }));
    }
  });
}

export interface QuickAddSessionExpenseInput {
  session: Session;
  amountCents: number;
  /** Effective phase for the new expense (DEC-053c boundary choice). */
  phaseId: string;
  currency: string;
  /** Category of the session's profile — same rule as OutingPage quick-add. */
  profileCategory: string | null;
}

/**
 * DEC-120/DEC-124 (R-11): canonical domain twin of the service worker's
 * direct quick-add (public/sw.js swDirectQuickAdd) — the SW replicates this
 * record shape 1:1 and these tests are its executable spec. Creates the
 * expense + session item atomically; the item order is derived inside the
 * transaction so concurrent adds stay consistent.
 */
export async function quickAddSessionExpense(
  input: QuickAddSessionExpenseInput,
): Promise<Transaction> {
  const tx = createExpenseTransaction({
    tripId: input.session.tripId,
    phaseId: input.phaseId,
    budgetPoolId: input.session.budgetPoolId,
    walletId: null,
    amountCents: input.amountCents,
    currency: input.currency,
    category: input.profileCategory ?? 'other',
    description: input.session.name,
    sessionId: input.session.id,
    activityProfileId: input.session.activityProfileId,
  });

  await db.transaction('rw', [db.transactions, db.sessionItems], async () => {
    const order = await db.sessionItems
      .where('sessionId')
      .equals(input.session.id)
      .count();
    await db.transactions.add(tx);
    await db.sessionItems.add(createSessionItem(input.session.id, tx.id, order + 1));
  });

  return tx;
}

/**
 * DEC-120/DEC-124 (R-11): domain twin of the SW's swDirectSetSubcategory
 * (follow-up notification action — "what was that expense?").
 */
export async function assignTransactionSubcategory(
  transactionId: string,
  subcategoryId: string,
): Promise<void> {
  const tx = await db.transactions.get(transactionId);
  if (!tx || tx.deletedAt !== null) return;
  await db.transactions.put(markUpdated({ ...tx, subcategoryId }));
}

export interface RepeatLastSessionItemInput {
  session: Session;
  /** The item being repeated (its amount/category/subcategory/sharing). */
  lastTx: Transaction;
  /** Shares of the last item — empty for a simple (non-shared) item. */
  lastShares: ParticipantShare[];
  /** Effective phase for the new expense (DEC-053c boundary choice). */
  phaseId: string;
  currency: string;
  ownerId: string;
}

/**
 * E3 (M7): repeat the last session item — a fresh expense identical to the
 * previous one. Sharing is respected (DEC-114): a shared item is rebuilt with
 * the same payer/participants/split via resolvePayerExpense, so the new debt
 * is born confirmed for the owner and pending for third parties (DEC-071).
 * Persisted atomically (D-H / GAP-030) with its session item and shares.
 */
export async function repeatLastSessionItem(
  input: RepeatLastSessionItemInput,
): Promise<Transaction> {
  const { session, lastTx, lastShares, phaseId, currency, ownerId } = input;

  const tx = createExpenseTransaction({
    tripId: session.tripId,
    phaseId,
    budgetPoolId: session.budgetPoolId,
    walletId: lastTx.walletId,
    amountCents: lastTx.amountCents,
    currency,
    category: lastTx.category ?? 'other',
    subcategoryId: lastTx.subcategoryId,
    description: lastTx.description,
    sessionId: session.id,
    activityProfileId: session.activityProfileId,
  });

  let shares: ParticipantShare[] = [];
  if (lastTx.isShared && lastShares.length > 0) {
    const payerId = lastTx.paidByParticipantId ?? ownerId;
    const resolution = resolvePayerExpense({
      transactionId: tx.id,
      amountCents: lastTx.amountCents,
      ownerId,
      payerId,
      didSplit: true,
      participantIds: lastShares.map((s) => s.participantId),
      shareType: lastShares[0]!.shareType,
      customAmountsCents: Object.fromEntries(
        lastShares.map((s) => [s.participantId, s.shareAmountCents]),
      ),
    });
    tx.isShared = resolution.isShared;
    tx.paidByParticipantId = payerId;
    tx.personalCostCents = resolution.personalCostCents;
    tx.walletId = resolution.movesOwnerWallet ? lastTx.walletId : null;
    shares = resolution.shares;
  }

  await db.transaction('rw', [db.transactions, db.sessionItems, db.participantShares], async () => {
    const order = await db.sessionItems.where('sessionId').equals(session.id).count();
    await db.transactions.add(tx);
    if (shares.length > 0) await db.participantShares.bulkAdd(shares);
    await db.sessionItems.add(createSessionItem(session.id, tx.id, order + 1));
  });

  return tx;
}

export interface AddRoundExpensesInput {
  session: Session;
  count: number;
  unitPriceCents: number;
  /** Effective phase for the new expenses (DEC-053c boundary choice). */
  phaseId: string;
  currency: string;
  profileCategory: string | null;
  /**
   * When set, every drink is split equally among `participantIds` and paid by
   * `payerId`. The owner MUST be the first participant so the personal cost
   * matches calculateRoundPersonalCents.
   */
  split: { ownerId: string; payerId: string; participantIds: string[] } | null;
}

/**
 * E3 (M8): a "round" — `count` drinks at the same unit price added in one go.
 * DEC-047/DEC-114: when split, each drink runs through resolvePayerExpense so
 * the owner keeps their equal share and the others' debts are tracked. All
 * transactions, shares and session items are written atomically; item order
 * is derived inside the transaction so concurrent adds stay consistent.
 */
export async function addRoundExpenses(
  input: AddRoundExpensesInput,
): Promise<Transaction[]> {
  const { session, count, unitPriceCents, phaseId, currency, profileCategory, split } = input;
  if (count <= 0 || unitPriceCents <= 0) return [];

  const txs: Transaction[] = [];
  const allShares: ParticipantShare[] = [];

  for (let i = 0; i < count; i++) {
    const tx = createExpenseTransaction({
      tripId: session.tripId,
      phaseId,
      budgetPoolId: session.budgetPoolId,
      walletId: null,
      amountCents: unitPriceCents,
      currency,
      category: profileCategory ?? 'other',
      description: session.name,
      sessionId: session.id,
      activityProfileId: session.activityProfileId,
      isShared: split !== null,
      paidByParticipantId: split?.payerId ?? null,
    });
    if (split) {
      const resolution = resolvePayerExpense({
        transactionId: tx.id,
        amountCents: unitPriceCents,
        ownerId: split.ownerId,
        payerId: split.payerId,
        didSplit: true,
        participantIds: split.participantIds,
        shareType: 'equal',
        customAmountsCents: {},
      });
      tx.personalCostCents = resolution.personalCostCents;
      if (!resolution.movesOwnerWallet) tx.walletId = null;
      allShares.push(...resolution.shares);
    }
    txs.push(tx);
  }

  await db.transaction('rw', [db.transactions, db.sessionItems, db.participantShares], async () => {
    const baseOrder = await db.sessionItems.where('sessionId').equals(session.id).count();
    await db.transactions.bulkAdd(txs);
    if (allShares.length > 0) await db.participantShares.bulkAdd(allShares);
    for (let i = 0; i < txs.length; i++) {
      await db.sessionItems.add(createSessionItem(session.id, txs[i]!.id, baseOrder + i + 1));
    }
  });

  return txs;
}
