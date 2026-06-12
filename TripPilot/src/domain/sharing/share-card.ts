import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPool } from '@/domain/types/budget-pool';
import { calculateTotalBudget, calculateTotalSpent } from '@/domain/budget';

/**
 * DEC-133: shareable trip summary card. Scope exception recorded in the
 * decision log: this is a LOCAL image export via the OS share sheet — the
 * app itself gains no social surface (DEC-011 still holds).
 */

export interface ShareCardStats {
  totalSpentCents: number;
  totalBudgetCents: number;
  /** Rounded 0..100+ (may exceed 100 when over budget). */
  percentUsed: number;
  dayNumber: number;
  totalDays: number;
  /** Trip progress 0..100 used as the pace marker on the card's bar. */
  dayPercent: number;
  topCategory: { category: string; totalCents: number } | null;
}

export interface BuildShareCardStatsInput {
  transactions: Transaction[];
  pools: BudgetPool[];
  dayNumber: number;
  totalDays: number;
}

function findTopCategory(
  transactions: Transaction[],
): { category: string; totalCents: number } | null {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense' || !tx.category) continue;
    const cost = tx.personalCostCents ?? tx.amountCents;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + cost);
  }
  let top: { category: string; totalCents: number } | null = null;
  for (const [category, totalCents] of totals) {
    if (!top || totalCents > top.totalCents) top = { category, totalCents };
  }
  return top;
}

export function buildShareCardStats(input: BuildShareCardStatsInput): ShareCardStats {
  const totalSpentCents = calculateTotalSpent(input.transactions);
  const totalBudgetCents = calculateTotalBudget(input.pools);
  const percentUsed =
    totalBudgetCents > 0 ? Math.round((totalSpentCents / totalBudgetCents) * 100) : 0;

  const totalDays = Math.max(1, input.totalDays);
  const dayNumber = Math.min(Math.max(1, input.dayNumber), totalDays);
  const dayPercent = Math.round((dayNumber / totalDays) * 100);

  return {
    totalSpentCents,
    totalBudgetCents,
    percentUsed,
    dayNumber,
    totalDays,
    dayPercent,
    topCategory: findTopCategory(input.transactions),
  };
}
