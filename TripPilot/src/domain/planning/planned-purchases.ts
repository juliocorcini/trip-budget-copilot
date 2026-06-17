import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { Transaction } from '@/domain/types/transaction';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface CreatePlannedPurchaseInput {
  tripId: string;
  budgetPoolId: string;
  name: string;
  category: string;
  estimatedCostCents: number;
  /** Defaults to the estimate when omitted; pass `null` to track without reserving. */
  reservedCents?: number | null;
  store?: string | null;
  targetDate?: string | null;
  notes?: string | null;
  phaseId?: string | null;
}

/** DEC-175: a fresh planned purchase, born `planned` with no linked expenses. */
export function createPlannedPurchase(input: CreatePlannedPurchaseInput): PlannedPurchase {
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    budgetPoolId: input.budgetPoolId,
    name: input.name,
    category: input.category,
    estimatedCostCents: input.estimatedCostCents,
    reservedCents:
      input.reservedCents === undefined ? input.estimatedCostCents : input.reservedCents,
    status: 'planned',
    linkedTransactionIds: [],
    store: input.store ?? null,
    targetDate: input.targetDate ?? null,
    notes: input.notes ?? null,
    phaseId: input.phaseId ?? null,
  };
}

/** DEC-175: open = still reserving (planned and not deleted). */
export function isPlannedPurchaseOpen(purchase: PlannedPurchase): boolean {
  return purchase.deletedAt === null && purchase.status === 'planned';
}

/**
 * D-IMP-03: planned purchases an EXISTING expense can be attributed to, from the
 * expense side. A purchase is compatible when it is open (still reserving), sits
 * in the SAME fund as the expense, and has not already linked this expense. Only
 * real expenses qualify (income is never a planned-purchase buy). Pure mirror of
 * the picker filter on the Planned screen so both directions agree.
 */
export function compatiblePlannedPurchasesForExpense(
  expense: Transaction,
  purchases: PlannedPurchase[],
): PlannedPurchase[] {
  if (expense.type !== 'expense') return [];
  return purchases.filter(
    (purchase) =>
      isPlannedPurchaseOpen(purchase) &&
      purchase.budgetPoolId === expense.budgetPoolId &&
      !purchase.linkedTransactionIds.includes(expense.id),
  );
}

/**
 * DEC-175: real money already spent toward this purchase = the base personal
 * cost of its linked, non-deleted expense transactions. Mirrors pool spent
 * (`transactionBasePersonalCostCents`) so shared/foreign-currency rows agree.
 */
export function plannedPurchaseSpentCents(
  purchase: PlannedPurchase,
  transactions: Transaction[],
): number {
  if (purchase.linkedTransactionIds.length === 0) return 0;
  const linked = new Set(purchase.linkedTransactionIds);
  return transactions
    .filter((t) => linked.has(t.id) && t.deletedAt === null)
    .reduce((sum, t) => sum + transactionBasePersonalCostCents(t), 0);
}

/**
 * DEC-175: the amount that still deducts from free-to-spend. The reserve shrinks
 * by real spend so the earmark and the real expense are never double counted;
 * once bought/cancelled it deducts nothing.
 */
export function plannedPurchaseReservedRemainingCents(
  purchase: PlannedPurchase,
  transactions: Transaction[],
): number {
  if (!isPlannedPurchaseOpen(purchase) || purchase.reservedCents === null) return 0;
  const spent = plannedPurchaseSpentCents(purchase, transactions);
  return Math.max(0, purchase.reservedCents - spent);
}

/**
 * DEC-175: the free-to-spend term — total still-reserved across the OPEN planned
 * purchases charged to a given pool. Used by `calculateFreeToSpend`.
 */
export function calculatePlannedPurchaseReserves(
  purchases: PlannedPurchase[],
  transactions: Transaction[],
  poolId: string,
): number {
  return purchases
    .filter((p) => p.budgetPoolId === poolId)
    .reduce((sum, p) => sum + plannedPurchaseReservedRemainingCents(p, transactions), 0);
}

export interface PlannedPurchaseProgress {
  spentCents: number;
  estimatedCostCents: number;
  remainingReserveCents: number;
  /** 0–100, how much of the estimate has been spent (clamped). */
  percent: number;
}

/** DEC-175: per-purchase progress for the list UI. */
export function plannedPurchaseProgress(
  purchase: PlannedPurchase,
  transactions: Transaction[],
): PlannedPurchaseProgress {
  const spentCents = plannedPurchaseSpentCents(purchase, transactions);
  const estimatedCostCents = purchase.estimatedCostCents;
  const remainingReserveCents = plannedPurchaseReservedRemainingCents(purchase, transactions);
  const percent =
    estimatedCostCents > 0
      ? Math.min(100, Math.round((spentCents / estimatedCostCents) * 100))
      : spentCents > 0
        ? 100
        : 0;
  return { spentCents, estimatedCostCents, remainingReserveCents, percent };
}

/**
 * DEC-175: link a just-logged expense to the purchase. Appends the id (idempotent)
 * and, for purchases that hold a reserve, auto-closes (status `bought`) once the
 * reserve is fully consumed — the real spend has taken over. Track-only purchases
 * (`reservedCents === null`) never auto-close: they have no reserve to deplete and
 * may collect spend across several stores, so they wait for an explicit "bought".
 * Pure: returns the next purchase, never writes.
 */
export function linkTransactionToPlannedPurchase(
  purchase: PlannedPurchase,
  transactionId: string,
  transactions: Transaction[],
): PlannedPurchase {
  const linkedTransactionIds = purchase.linkedTransactionIds.includes(transactionId)
    ? purchase.linkedTransactionIds
    : [...purchase.linkedTransactionIds, transactionId];
  const next: PlannedPurchase = { ...purchase, linkedTransactionIds };
  const reserveDepleted = plannedPurchaseReservedRemainingCents(next, transactions) <= 0;
  if (next.status === 'planned' && next.reservedCents !== null && reserveDepleted) {
    next.status = 'bought';
  }
  return next;
}
