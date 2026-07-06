import { db } from '@/data/db/database';
import { endSession, createSessionItem } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { updateProfileFromTransaction } from '@/domain/forecasting';
import { isPaidByOwner, resolvePayerExpense } from '@/domain/splitting';
import { resolveAutoWalletId } from '@/domain/wallets';
import { createBudgetPool, createEnvelope, computePoolTransfer } from '@/domain/budget';
import { markUpdated, softDelete } from '@/utils/entity-factory';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

/**
 * DEC-473: the trip's auto-assignable wallet (explicit default, else the lone
 * wallet) read straight from the ledger — for orchestrators whose callers don't
 * carry the wallet list (session quick-adds, rounds).
 */
async function resolveTripAutoWalletId(tripId: string): Promise<string | null> {
  const wallets = await db.wallets.where('tripId').equals(tripId).toArray();
  return resolveAutoWalletId(wallets);
}

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

      // DEC-072 (M6.4): a SUB-DESTINATION outing confirms its occurrence — the
      // reserve stops deducting and real spending takes over. DEC-400 (G1): an
      // EVENT is NEVER confirmed by ending one of its outings — it owns N outings
      // over time and only "encerrar evento" ends it (Â-EVENT-LIFECYCLE). Ending
      // an event-outing leaves the event live; its reserve is already netted by
      // the outing spend (eventConsumedSpentCents), so no double count.
      const occurrence = await db.plannedOccurrences
        .filter((o) => o.linkedSessionId === input.session.id && o.deletedAt === null)
        .first();
      if (occurrence && occurrence.kind === 'sub_destination' && !occurrence.isConfirmed) {
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
 * DEC-400 (G1): "iniciar evento" — mark the event explicitly started. From here
 * it is live and STAYS live (even past its date) until "encerrar evento"; it
 * never disappears on its own (Â-EVENT-LIFECYCLE). Idempotent — a re-start keeps
 * the first timestamp. No money moves. Atomic single write.
 */
export async function startEvent(occurrenceId: string): Promise<void> {
  await db.transaction('rw', [db.plannedOccurrences], async () => {
    const occurrence = await db.plannedOccurrences.get(occurrenceId);
    if (!occurrence || occurrence.deletedAt !== null || occurrence.startedAt != null) return;
    await db.plannedOccurrences.put(
      markUpdated({ ...occurrence, startedAt: new Date().toISOString() }),
    );
  });
}

export interface StartOutingForEventInput {
  session: Session;
  occurrenceId: string;
}

/**
 * DEC-400 (G1): "iniciar saída" from a live event — start an outing that BELONGS
 * to the event (back-linked via `Session.occurrenceId`) WITHOUT touching the
 * legacy 1:1 `linkedSessionId`, so the event can own several outings over time.
 * Starting an outing implies the event is live, so it is marked started if it was
 * not. The outing's spend nets into the event reserve exactly once
 * (eventConsumedSpentCents — Â-EVENT-NO-DOUBLE-COUNT). Atomic.
 */
export async function startOutingForEvent(input: StartOutingForEventInput): Promise<void> {
  await db.transaction('rw', [db.sessions, db.plannedOccurrences], async () => {
    await db.sessions.add({ ...input.session, occurrenceId: input.occurrenceId });
    const occurrence = await db.plannedOccurrences.get(input.occurrenceId);
    if (occurrence && occurrence.deletedAt === null && occurrence.startedAt == null) {
      await db.plannedOccurrences.put(
        markUpdated({ ...occurrence, startedAt: new Date().toISOString() }),
      );
    }
  });
}

/**
 * DEC-400 (G1): "encerrar evento" — explicitly end the event. Closes every still
 * RUNNING outing of the event (legacy `linkedSessionId` + `Session.occurrenceId`
 * back-links; their expenses already live in the ledger, so no money moves) and
 * marks the event ended (`endedAt`). It is NOT confirmed here: any unspent
 * reserve stays held and surfaces the leftover prompt (DEC-387), which the user
 * resolves to free/cofrinho/pote — never auto-decided (A4). Atomic.
 */
export async function endEvent(occurrenceId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await db.transaction('rw', [db.plannedOccurrences, db.sessions], async () => {
    const occurrence = await db.plannedOccurrences.get(occurrenceId);
    if (!occurrence || occurrence.deletedAt !== null) return;

    const outingIds = new Set<string>();
    if (occurrence.linkedSessionId !== null) outingIds.add(occurrence.linkedSessionId);
    const backLinked = await db.sessions
      .filter((s) => s.occurrenceId === occurrenceId && s.deletedAt === null)
      .toArray();
    for (const session of backLinked) outingIds.add(session.id);
    for (const sessionId of outingIds) {
      const session = await db.sessions.get(sessionId);
      if (session && session.deletedAt === null && session.status === 'active') {
        await db.sessions.put(markUpdated(endSession(session)));
      }
    }

    await db.plannedOccurrences.put(markUpdated({ ...occurrence, endedAt: nowIso }));
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

/**
 * DEC-387 (G4): how the still-held leftover of an ended event is resolved. Mirrors
 * the phase-leftover destinations (DEC-217 `applyPhaseLeftover`), conserving money
 * 1:1 (Â-LEFTOVER-CONSERVED):
 *  - free:  the reserve simply closes (`isConfirmed`); the leftover returns to the
 *           phase free-to-spend. No pool/envelope changes.
 *  - piggy: a labeled `protected_reserve` envelope ("Sobra de {evento}") on the
 *           event's pool — the money stays in the pool but set aside; pool totals
 *           untouched, so the trip total is preserved.
 *  - pot:   a dedicated `global` pot ("Sobra de {evento}") receives the leftover via
 *           an atomic pool→pool transfer (source ↓ = pot ↑) — trip total invariant.
 */
export type EventLeftoverDestination = 'free' | 'piggy' | 'pot';

export interface ResolveEventLeftoverInput {
  occurrenceId: string;
  /** The leftover (`max(0, reserved − consumed)`) the UI computed for this event. */
  amountCents: number;
  destination: EventLeftoverDestination;
  /** Localized "Sobra de {evento}" label for the envelope/pot (UI supplies t()). */
  leftoverLabel: string;
  /** Trip + currency — only used to create the dedicated pot. */
  tripId: string;
  currency: string;
}

/**
 * DEC-387 (G4): apply the user's choice for an ended event's leftover, atomically.
 * Every destination first marks the event resolved (`isConfirmed`) so the reserve
 * stops deducting and the prompt never reopens; piggy/pot then re-home the money
 * without changing the trip total. Never auto-decided — only an explicit choice
 * runs this (a dismissed prompt leaves the event pending, A4).
 */
export async function resolveEventLeftover(input: ResolveEventLeftoverInput): Promise<void> {
  await db.transaction('rw', [db.plannedOccurrences, db.envelopes, db.budgetPools], async () => {
    const occurrence = await db.plannedOccurrences.get(input.occurrenceId);
    if (!occurrence || occurrence.deletedAt !== null) return;
    // Resolve the event: the consumable reserve returns 0 from here on, releasing
    // the held leftover back into the pool's free-to-spend.
    await db.plannedOccurrences.put(markUpdated({ ...occurrence, isConfirmed: true }));

    if (input.amountCents <= 0 || input.destination === 'free') return;

    if (input.destination === 'piggy') {
      // Set the leftover aside in the same pool as a labeled protected reserve —
      // free −= L cancels the release above, so net free is unchanged and the
      // money is conserved, now visibly earmarked "Sobra de {evento}".
      await db.envelopes.add(
        createEnvelope({
          budgetPoolId: occurrence.budgetPoolId,
          kind: 'protected_reserve',
          name: input.leftoverLabel,
          amountCents: input.amountCents,
        }),
      );
      return;
    }

    // 'pot' — move the leftover into a dedicated global pot, conserving the trip
    // total (source pool ↓ = pot ↑, computePoolTransfer / ÂNCORA 13).
    const source = await db.budgetPools.get(occurrence.budgetPoolId);
    if (!source) return;
    const pot = createBudgetPool({
      tripId: input.tripId,
      name: input.leftoverLabel,
      scope: 'global',
      totalAmountCents: 0,
      currency: input.currency,
    });
    const moved = computePoolTransfer(source.totalAmountCents, pot.totalAmountCents, input.amountCents);
    await db.budgetPools.put(markUpdated({ ...source, totalAmountCents: moved.sourceTotalCents }));
    await db.budgetPools.add({ ...pot, totalAmountCents: moved.targetTotalCents });
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
    // DEC-473: quick-adds are the owner's own money — app-wide auto policy.
    walletId: await resolveTripAutoWalletId(input.session.tripId),
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
  // DEC-473: resolved once for the whole round (cleared per-drink below when
  // someone else paid — movesOwnerWallet false).
  const autoWalletId = await resolveTripAutoWalletId(session.tripId);

  for (let i = 0; i < count; i++) {
    const tx = createExpenseTransaction({
      tripId: session.tripId,
      phaseId,
      budgetPoolId: session.budgetPoolId,
      walletId: autoWalletId,
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
