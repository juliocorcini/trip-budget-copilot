import { db } from '@/data/db/database';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Settlement } from '@/domain/types/settlement';
import type { WiseImportDraft, WiseAllocation } from '@/domain/import';
import { wiseExternalRef } from '@/domain/import';
import {
  createExpenseTransaction,
  createIncomeTransaction,
  createTransferTransaction,
} from '@/domain/transactions/transactions';
import { createSettlement, resolvePayerExpense } from '@/domain/splitting';
import { softDelete } from '@/utils/entity-factory';

/**
 * F16 (round 2): a purchase split on import via the reimbursement bridge. The
 * owner paid the whole card charge; `participantId` owes `shareAmountCents` of
 * it. The matching incoming transfer is committed separately as `settle_incoming`
 * for the same amount, so the debt is born and immediately repaid.
 */
export interface WiseExpenseBridge {
  /** Participant who owes a slice of this purchase (already persisted). */
  participantId: string;
  /** What that participant owes of the purchase, in cents (< amount). */
  shareAmountCents: number;
}

export interface CommitWiseImportInput {
  /** Only the drafts the user chose to import (already filtered + importable). */
  drafts: WiseImportDraft[];
  tripId: string;
  /** Operational pool that owns the imported expenses' budget (fallback only). */
  budgetPoolId: string;
  /** Wise wallet the card purchases are debited from. */
  walletId: string;
  /** Fallback phase when a draft could not be matched to one by date. */
  fallbackPhaseId: string;
  /**
   * Julio field feedback: phaseId → the operational pool dedicated to that phase.
   * Each row lands in the pool of ITS phase (by date) instead of a single fixed
   * pool, which dumped every imported expense into the first trecho. Absent →
   * everything falls back to `budgetPoolId` (legacy single-pool trips).
   */
  poolByPhaseId?: Record<string, string>;
  /** When set, ALL rows are forced into this phase (the import phase override),
   *  ignoring each row's date-derived phase. Null/absent → auto by date. */
  forcePhaseId?: string | null;
  /** Owner participant id — required only when `bridges` is provided. */
  ownerId?: string;
  /** F16: draft.rowId → split-on-import bridge. The purchase becomes shared. */
  bridges?: Record<string, WiseExpenseBridge>;
  /**
   * DEC-386 (G3): draft.rowId → the event (`PlannedOccurrence`) the user tagged
   * this imported purchase as part of. Sets `occurrenceId` on the expense, so the
   * Wise statement is a third explicit attribution path (manual/AI/Wise) that
   * feeds the consumable event reserve (DEC-385). Event XOR session is enforced
   * by the factory; a credit/income row is never event-tagged. Absent → no event.
   */
  occurrenceByRowId?: Record<string, string>;
}

/**
 * The phase + operational pool a Wise row should commit to: a forced phase wins,
 * else the row's date-derived phase, else the fallback; the pool is the one
 * dedicated to THAT phase (so money never lands in the wrong trecho).
 */
function resolveWisePhasePool(
  input: { fallbackPhaseId: string; budgetPoolId: string; poolByPhaseId?: Record<string, string>; forcePhaseId?: string | null },
  draftPhaseId: string | null,
): { phaseId: string; budgetPoolId: string } {
  const phaseId = input.forcePhaseId ?? draftPhaseId ?? input.fallbackPhaseId;
  return { phaseId, budgetPoolId: input.poolByPhaseId?.[phaseId] ?? input.budgetPoolId };
}

export interface CommitWiseImportResult {
  /** Ids of the inserted transactions — drives the undo toast. */
  transactionIds: string[];
  /**
   * DEC-395 (G5): the inserted records, so the caller can forward-geocode each
   * imported expense to its venue in the background (place parity, A5).
   */
  transactions: Transaction[];
}

/**
 * DEC-200: persists the selected Wise rows as expenses, atomically. Every
 * record carries its `externalRef` (`wise:<id>`) so a re-import of the same
 * file is recognized as already-imported, and `excludeFromLearning` so a
 * batch of historical card purchases never skews the quick-value learning.
 *
 * Same-currency rows (the wallet currency equals the row currency) need no
 * conversion; a foreign row falls back to its own amount as the base value
 * (documented multi-currency limitation — the importer does not invent rates).
 * The whole batch is one Dexie transaction: a crash imports all-or-nothing.
 */
export async function commitWiseImport(
  input: CommitWiseImportInput,
): Promise<CommitWiseImportResult> {
  const importable = input.drafts.filter((d) => d.importable);
  if (importable.length === 0) return { transactionIds: [], transactions: [] };

  const transactions: Transaction[] = [];
  const shares: ParticipantShare[] = [];

  for (const draft of importable) {
    // D-BUG-06: a pure credit (positive amount, no counterparty) is real income.
    // It grows the operational pool and credits the Wise wallet, reusing the income
    // factory (category null, excludeFromLearning true). It carries the same
    // `externalRef` as an expense so a re-import is recognized as a duplicate.
    if (draft.kind === 'credit') {
      const creditTarget = resolveWisePhasePool(input, draft.phaseId);
      const income = createIncomeTransaction({
        tripId: input.tripId,
        phaseId: creditTarget.phaseId,
        budgetPoolId: creditTarget.budgetPoolId,
        walletId: input.walletId,
        amountCents: draft.amountCents,
        currency: draft.currency,
        baseCurrencyAmountCents: draft.amountCents,
        exchangeRate: null,
        description: draft.description,
        date: draft.dateIso,
      });
      income.externalRef = draft.externalRef;
      transactions.push(income);
      continue;
    }

    const bridge = input.bridges?.[draft.rowId];
    const target = resolveWisePhasePool(input, draft.phaseId);
    // The importer never invents exchange rates: the base-currency value equals
    // the original amount (exchangeRate null). For a same-currency statement
    // (the common case — an EUR wallet on an EUR trip) this is exact; a foreign
    // statement keeps its own number as the documented multi-currency fallback.
    const tx = createExpenseTransaction({
      tripId: input.tripId,
      phaseId: target.phaseId,
      budgetPoolId: target.budgetPoolId,
      walletId: input.walletId,
      amountCents: draft.amountCents,
      currency: draft.currency,
      baseCurrencyAmountCents: draft.amountCents,
      exchangeRate: null,
      category: draft.category,
      description: draft.description,
      date: draft.dateIso,
      placeLabel: draft.city,
      externalRef: draft.externalRef,
      excludeFromLearning: true,
      // F16 bridge: the owner paid the whole card charge, split with the person.
      isShared: bridge !== undefined,
      paidByParticipantId: bridge && input.ownerId ? input.ownerId : null,
      // DEC-386 (G3): the event the user tagged this row as part of (if any).
      occurrenceId: input.occurrenceByRowId?.[draft.rowId] ?? null,
    });

    if (bridge && input.ownerId) {
      // Owner paid, person owes their slice (custom split). The owner's own
      // share is born confirmed so the debt exists immediately (DEC-114/071).
      const resolution = resolvePayerExpense({
        transactionId: tx.id,
        amountCents: draft.amountCents,
        ownerId: input.ownerId,
        payerId: input.ownerId,
        didSplit: true,
        participantIds: [input.ownerId, bridge.participantId],
        shareType: 'custom',
        customAmountsCents: {
          [bridge.participantId]: bridge.shareAmountCents,
          [input.ownerId]: draft.amountCents - bridge.shareAmountCents,
        },
      });
      tx.personalCostCents = resolution.personalCostCents;
      // The person already paid this share back (the incoming transfer settles it
      // in the same batch), so the debt is acknowledged now — born confirmed, not
      // pending cross-device confirmation. Without this the settlement would not
      // net to zero (DEC-071: only confirmed shares consolidate into debts).
      shares.push(
        ...resolution.shares.map((s) => ({ ...s, confirmationStatus: 'confirmed' as const })),
      );
    }

    transactions.push(tx);
  }

  await db.transaction('rw', [db.transactions, db.participantShares], async () => {
    await db.transactions.bulkAdd(transactions);
    if (shares.length > 0) await db.participantShares.bulkAdd(shares);
  });

  return { transactionIds: transactions.map((tx) => tx.id), transactions };
}

/* ─────────────────── FIELD-14: Wise TRANSFER commit ─────────────────── */

export interface WiseTransferCommitSpec {
  /** The TRANSFER draft being committed. */
  draft: WiseImportDraft;
  /** Matched/confirmed participant (required for debt & person-paid kinds). */
  participantId: string | null;
  /** Split slices — already validated to sum to the transfer amount. */
  allocations: WiseAllocation[];
}

export interface CommitWiseTransfersInput {
  specs: WiseTransferCommitSpec[];
  tripId: string;
  /** Owner participant id (the user) — debtor/creditor anchor for settlements. */
  ownerId: string;
  /** Operational pool that owns any expense slice's budget (fallback only). */
  budgetPoolId: string;
  /** The Wise wallet money leaves from (out) / lands in (wallet moves). */
  sourceWalletId: string;
  fallbackPhaseId: string;
  baseCurrency: string;
  /** phaseId → its dedicated operational pool (see CommitWiseImportInput). */
  poolByPhaseId?: Record<string, string>;
  /** Force every transfer slice into this phase (import override). */
  forcePhaseId?: string | null;
}

export interface CommitWiseTransfersResult {
  transactionIds: string[];
  settlementIds: string[];
}

/**
 * FIELD-14 (DEC-200): turns classified Wise transfers into real records — a
 * single transfer can fan out into a debt settlement, a reimbursed expense (the
 * person paid → expense + settlement), a wallet-to-wallet move, and/or a plain
 * expense. Every record carries the transfer's `externalRef` so a re-import is
 * recognized and an undo can reverse the whole group. Atomic across the three
 * affected tables.
 *
 * Money semantics (Core Rule 3 / DEC-052 / DEC-114):
 *  - pay_debt          → settlement(I → person): clears what I owe; no budget hit.
 *  - person_paid_expense → expense paid by the person (my full cost, budget hit)
 *                          + settlement(I → person): the debt is born and paid.
 *  - wallet_transfer   → Wise → other wallet; never touches the budget.
 *  - my_expense        → plain expense from the Wise wallet; budget hit.
 *  - settle_incoming   → settlement(person → me): clears what they owe me.
 */
export async function commitWiseTransfers(
  input: CommitWiseTransfersInput,
): Promise<CommitWiseTransfersResult> {
  const transactions: Transaction[] = [];
  const shares: ParticipantShare[] = [];
  const settlements: Settlement[] = [];

  for (const spec of input.specs) {
    const { draft, participantId, allocations } = spec;
    const ref = wiseExternalRef(draft.rowId);
    const target = resolveWisePhasePool(input, draft.phaseId);
    const phaseId = target.phaseId;
    const expensePoolId = target.budgetPoolId;
    const currency = draft.currency || input.baseCurrency;

    for (const alloc of allocations) {
      if (alloc.kind === 'ignore' || alloc.amountCents <= 0) continue;

      if (alloc.kind === 'pay_debt') {
        if (!participantId) continue;
        settlements.push({
          ...createSettlement(input.tripId, input.ownerId, participantId, alloc.amountCents, currency),
          externalRef: ref,
        });
      } else if (alloc.kind === 'settle_incoming') {
        if (!participantId) continue;
        settlements.push({
          ...createSettlement(input.tripId, participantId, input.ownerId, alloc.amountCents, currency),
          externalRef: ref,
        });
      } else if (alloc.kind === 'wallet_transfer') {
        if (!alloc.targetWalletId || alloc.targetWalletId === input.sourceWalletId) continue;
        const tx = createTransferTransaction({
          tripId: input.tripId,
          phaseId,
          sourceWalletId: input.sourceWalletId,
          targetWalletId: alloc.targetWalletId,
          amountCents: alloc.amountCents,
          currency,
          description: draft.description,
          date: draft.dateIso,
        });
        tx.externalRef = ref;
        transactions.push(tx);
      } else if (alloc.kind === 'my_expense') {
        transactions.push(
          createExpenseTransaction({
            tripId: input.tripId,
            phaseId,
            budgetPoolId: expensePoolId,
            walletId: input.sourceWalletId,
            amountCents: alloc.amountCents,
            currency,
            baseCurrencyAmountCents: alloc.amountCents,
            exchangeRate: null,
            category: alloc.category ?? draft.category,
            description: draft.description,
            date: draft.dateIso,
            externalRef: ref,
            excludeFromLearning: true,
          }),
        );
      } else if (alloc.kind === 'person_paid_expense') {
        if (!participantId) continue;
        // The person paid for my expense → record it as mine (paid by them) so it
        // hits my budget and is born as a debt to them, then settle that debt now
        // (this transfer IS the reimbursement). Net debt: zero; budget: +expense.
        const tx = createExpenseTransaction({
          tripId: input.tripId,
          phaseId,
          budgetPoolId: expensePoolId,
          walletId: null,
          amountCents: alloc.amountCents,
          currency,
          baseCurrencyAmountCents: alloc.amountCents,
          exchangeRate: null,
          category: alloc.category ?? draft.category,
          description: draft.description,
          date: draft.dateIso,
          isShared: true,
          paidByParticipantId: participantId,
          externalRef: ref,
          excludeFromLearning: true,
        });
        const resolution = resolvePayerExpense({
          transactionId: tx.id,
          amountCents: alloc.amountCents,
          ownerId: input.ownerId,
          payerId: participantId,
          didSplit: false,
          participantIds: [input.ownerId],
          shareType: 'equal',
          customAmountsCents: {},
        });
        tx.personalCostCents = resolution.personalCostCents;
        transactions.push(tx);
        shares.push(...resolution.shares);
        settlements.push({
          ...createSettlement(input.tripId, input.ownerId, participantId, alloc.amountCents, currency),
          externalRef: ref,
        });
      }
    }
  }

  if (transactions.length === 0 && settlements.length === 0) {
    return { transactionIds: [], settlementIds: [] };
  }

  await db.transaction(
    'rw',
    [db.transactions, db.participantShares, db.settlements],
    async () => {
      if (transactions.length > 0) await db.transactions.bulkAdd(transactions);
      if (shares.length > 0) await db.participantShares.bulkAdd(shares);
      if (settlements.length > 0) await db.settlements.bulkAdd(settlements);
    },
  );

  return {
    transactionIds: transactions.map((tx) => tx.id),
    settlementIds: settlements.map((s) => s.id),
  };
}

/**
 * Undo for an import that may have created settlements (transfers) on top of
 * transactions. Soft-deletes the transactions (and their shares, via the batch
 * helper) plus the settlements — fully reversing {@link commitWiseTransfers}.
 */
export async function undoWiseImportBatch(ids: {
  transactionIds: string[];
  settlementIds: string[];
}): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.participantShares, db.settlements],
    async () => {
      if (ids.transactionIds.length > 0) {
        const txs = await db.transactions.bulkGet(ids.transactionIds);
        await db.transactions.bulkPut(txs.filter((t) => t !== undefined).map((t) => softDelete(t!)));
        const shares = await db.participantShares
          .where('transactionId')
          .anyOf(ids.transactionIds)
          .toArray();
        await db.participantShares.bulkPut(shares.map((s) => softDelete(s)));
      }
      if (ids.settlementIds.length > 0) {
        const ss = await db.settlements.bulkGet(ids.settlementIds);
        await db.settlements.bulkPut(ss.filter((s) => s !== undefined).map((s) => softDelete(s!)));
      }
    },
  );
}
