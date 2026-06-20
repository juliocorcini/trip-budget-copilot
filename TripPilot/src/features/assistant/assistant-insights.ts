import {
  detectAmountAnomaly,
  getCategoryTypicalCents,
  filterTransactionsByPool,
} from '@/domain/transactions';
import { calculateFreeToSpend } from '@/domain/budget';
import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';

/**
 * AI Quick Entry (DEC-246) — the same "is this normal / can I afford it?" checks
 * QuickAdd surfaces (M5 anomaly + DEC-053/R3-J budget consequence), as ONE pure
 * function the preview can render without re-implementing the math. It is purely
 * informational: the sheet shows it as a non-blocking hint (the AI flow stays one
 * tap), unlike QuickAdd which gates the save behind a confirm sheet. Amounts are
 * BASE currency cents — the only kind the in-sheet editor handles (foreign goes
 * to the full editor), so they compare directly against the historical/budget data.
 */
export interface ExpenseInsightInput {
  amountBaseCents: number;
  category: string;
  budgetPoolId: string;
  currentPhaseId: string;
  transactions: Transaction[];
  pools: BudgetPool[];
  envelopes: Envelope[];
  links: BudgetPoolPhaseLink[];
  occurrences: PlannedOccurrence[];
  plannedPurchases: PlannedPurchase[];
}

export interface ExpenseInsights {
  /** The amount is far above the category's historical typical (likely a typo). */
  anomaly: boolean;
  /** Median-ish typical for the category (0 when too few samples to judge). */
  typicalCents: number;
  /** Free-to-spend left in the fund AFTER this expense (null when unknowable). */
  afterCents: number | null;
  /** The expense pushes the fund below zero. */
  over: boolean;
  poolName: string | null;
}

/** Pure: the anomaly + budget-consequence hints for a drafted base-currency expense. */
export function computeExpenseInsights(input: ExpenseInsightInput): ExpenseInsights {
  const typicalCents = getCategoryTypicalCents(input.transactions, input.category);
  const anomaly = detectAmountAnomaly(input.amountBaseCents, typicalCents);

  const pool = input.pools.find((p) => p.id === input.budgetPoolId) ?? null;
  let afterCents: number | null = null;
  if (pool) {
    const free = calculateFreeToSpend(
      pool,
      input.envelopes.filter((e) => e.budgetPoolId === pool.id),
      filterTransactionsByPool(input.transactions, pool.id),
      input.links.filter((l) => l.budgetPoolId === pool.id),
      input.currentPhaseId,
      input.occurrences,
      input.plannedPurchases,
    );
    afterCents = free.freeToSpendCents - input.amountBaseCents;
  }

  return {
    anomaly,
    typicalCents,
    afterCents,
    over: afterCents !== null && afterCents < 0,
    poolName: pool?.name ?? null,
  };
}
