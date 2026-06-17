import { db } from '@/data/db/database';
import { plannedPurchaseRepository, transactionRepository } from '@/data/repositories';
import {
  createPlannedPurchase,
  linkTransactionToPlannedPurchase,
  type CreatePlannedPurchaseInput,
} from '@/domain/planning/planned-purchases';
import { createExpenseTransaction, type CreateExpenseInput } from '@/domain/transactions';
import type { PlannedPurchase, PlannedPurchaseStatus } from '@/domain/types/planned-purchase';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Transaction } from '@/domain/types/transaction';
import { markUpdated, softDelete } from '@/utils/entity-factory';

/** DEC-175: create a planned purchase from form input. */
export async function addPlannedPurchase(
  input: CreatePlannedPurchaseInput,
): Promise<PlannedPurchase> {
  return plannedPurchaseRepository.create(createPlannedPurchase(input));
}

/** DEC-175: persist edits to an existing planned purchase. */
export async function updatePlannedPurchase(purchase: PlannedPurchase): Promise<PlannedPurchase> {
  return plannedPurchaseRepository.update(purchase);
}

/**
 * DEC-175: change status (cancel / re-open). Returns the saved record; callers
 * keep the pre-change snapshot to drive the undo toast.
 */
export async function setPlannedPurchaseStatus(
  purchase: PlannedPurchase,
  status: PlannedPurchaseStatus,
): Promise<PlannedPurchase> {
  return plannedPurchaseRepository.update({ ...purchase, status });
}

/** DEC-175: soft-delete (undoable via restorePlannedPurchase). */
export async function deletePlannedPurchase(id: string): Promise<void> {
  await plannedPurchaseRepository.delete(id);
}

/** DEC-175: undo a soft-delete by re-instating the pre-delete snapshot. */
export async function restorePlannedPurchase(purchase: PlannedPurchase): Promise<void> {
  await db.plannedPurchases.put(markUpdated({ ...purchase, deletedAt: null }));
}

export interface LogPlannedPurchaseExpenseInput {
  purchase: PlannedPurchase;
  expense: CreateExpenseInput;
  shares?: ParticipantShare[];
  /**
   * Force-close the purchase (the explicit "I bought it" action). When false,
   * the purchase only auto-closes if its reserve is fully consumed — so a
   * track-only or partially-spent purchase stays open across several stores.
   */
  close: boolean;
}

export interface LogPlannedPurchaseExpenseResult {
  transaction: Transaction;
  purchase: PlannedPurchase;
  /** The pre-change purchase, for the undo toast. */
  previousPurchase: PlannedPurchase;
}

/**
 * DEC-175: the "Comprei" flow. Creates a real expense for the purchase, links
 * it, and (optionally) closes the purchase — all in one transaction so the
 * earmark and its real spend never diverge. The reserve auto-shrinks by linked
 * spend inside free-to-spend, so nothing is double counted.
 */
export async function logPlannedPurchaseExpense(
  input: LogPlannedPurchaseExpenseInput,
): Promise<LogPlannedPurchaseExpenseResult> {
  const previousPurchase = input.purchase;
  const transaction = createExpenseTransaction(input.expense);

  // Remaining reserve must reflect prior linked spend plus this new expense, so
  // the auto-close decision is correct even after partial buys.
  const priorLinked =
    previousPurchase.linkedTransactionIds.length > 0
      ? await transactionRepository.getByIds(previousPurchase.linkedTransactionIds)
      : [];
  const linkContext = [...priorLinked, transaction];
  let next = linkTransactionToPlannedPurchase(previousPurchase, transaction.id, linkContext);
  if (input.close && next.status === 'planned') {
    next = { ...next, status: 'bought' };
  }

  const shares = input.shares ?? [];
  await db.transaction(
    'rw',
    [db.transactions, db.participantShares, db.plannedPurchases],
    async () => {
      await db.transactions.add(transaction);
      if (shares.length > 0) await db.participantShares.bulkAdd(shares);
      await db.plannedPurchases.put(markUpdated(next));
    },
  );

  return { transaction, purchase: next, previousPurchase };
}

export interface LinkExistingExpenseInput {
  purchase: PlannedPurchase;
  /** An expense that already exists on the device, recorded before the plan. */
  transaction: Transaction;
}

export interface LinkExistingExpenseResult {
  purchase: PlannedPurchase;
  /** The pre-link purchase, for the undo toast. */
  previousPurchase: PlannedPurchase;
}

/**
 * DEC-175 (B9): attribute an ALREADY-recorded expense to a planned purchase
 * ("I bought this before I created the plan"). Unlike "Comprei", it creates NO
 * new transaction — it only links the existing one, so the reserve shrinks by
 * the linked spend exactly once (no double counting). Reuses the same pure link
 * (auto-closes when the reserve is fully consumed). Returns the pre-link
 * snapshot for an undo.
 */
export async function linkExistingExpenseToPlannedPurchase(
  input: LinkExistingExpenseInput,
): Promise<LinkExistingExpenseResult> {
  const previousPurchase = input.purchase;
  // The auto-close decision must see prior linked spend plus this expense, so a
  // partially-spent or track-only purchase behaves like the "Comprei" path.
  const priorLinked =
    previousPurchase.linkedTransactionIds.length > 0
      ? await transactionRepository.getByIds(previousPurchase.linkedTransactionIds)
      : [];
  const linkContext = [...priorLinked, input.transaction];
  const next = linkTransactionToPlannedPurchase(
    previousPurchase,
    input.transaction.id,
    linkContext,
  );
  const saved = await plannedPurchaseRepository.update(next);
  return { purchase: saved, previousPurchase };
}

/** DEC-175 (B9): undo an existing-expense link by restoring the pre-link snapshot. */
export async function undoLinkExistingExpense(previousPurchase: PlannedPurchase): Promise<void> {
  await db.plannedPurchases.put(markUpdated(previousPurchase));
}

/**
 * DEC-175: undo a logged purchase expense — soft-delete the created transaction
 * (and its shares) and restore the purchase to its pre-buy snapshot.
 */
export async function undoLogPlannedPurchaseExpense(input: {
  transactionId: string;
  previousPurchase: PlannedPurchase;
}): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.participantShares, db.plannedPurchases],
    async () => {
      const tx = await db.transactions.get(input.transactionId);
      if (tx) {
        await db.transactions.put(softDelete(tx));
        const shares = await db.participantShares
          .where('transactionId')
          .equals(input.transactionId)
          .toArray();
        if (shares.length > 0) {
          await db.participantShares.bulkPut(shares.map((s) => softDelete(s)));
        }
      }
      await db.plannedPurchases.put(markUpdated(input.previousPurchase));
    },
  );
}
