import type { Transaction } from '@/domain/types/transaction';
import type { TransactionType, TransactionCategory } from '@/domain/types/common';
import { createSyncMetadata } from '@/utils/entity-factory';
import { localDayOf } from '@/domain/dates';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';

export interface CreateExpenseInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  walletId: string | null;
  amountCents: number;
  currency: string;
  /** E9 (M9): base-currency equivalent of a foreign expense. Defaults to
   * `amountCents` (same-currency expenses need no conversion). */
  baseCurrencyAmountCents?: number;
  /** E9 (M9): base units per 1 foreign unit; null for same-currency. */
  exchangeRate?: number | null;
  category: string;
  subcategoryId?: string | null;
  placeLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  description: string;
  date?: string;
  type?: TransactionType;
  isShared?: boolean;
  personalCostCents?: number | null;
  paidByParticipantId?: string | null;
  activityProfileId?: string | null;
  sessionId?: string | null;
  sourceWalletId?: string | null;
  targetWalletId?: string | null;
  notes?: string | null;
  /** DEC-200: imported records carry the source ref (e.g. `wise:CARD-…`). */
  externalRef?: string | null;
  /** DEC-200: imported values must not pollute the quick-value learning. */
  excludeFromLearning?: boolean;
}

export function createExpenseTransaction(input: CreateExpenseInput): Transaction {
  const now = new Date().toISOString();
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    phaseId: input.phaseId,
    budgetPoolId: input.budgetPoolId,
    walletId: input.walletId,
    sessionId: input.sessionId ?? null,
    type: input.type ?? 'expense',
    amountCents: input.amountCents,
    personalCostCents:
      input.personalCostCents !== undefined
        ? input.personalCostCents
        : input.isShared
          ? null
          : input.amountCents,
    currency: input.currency,
    baseCurrencyAmountCents: input.baseCurrencyAmountCents ?? input.amountCents,
    exchangeRate: input.exchangeRate ?? null,
    category: input.category,
    subcategoryId: input.subcategoryId ?? null,
    placeLabel: input.placeLabel ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    placeId: input.placeId ?? null,
    description: input.description,
    date: input.date ?? now,
    isShared: input.isShared ?? false,
    paidByParticipantId: input.paidByParticipantId ?? null,
    activityProfileId: input.activityProfileId ?? null,
    isSpecialOccasion: false,
    excludeFromLearning: input.excludeFromLearning ?? false,
    sourceWalletId: input.sourceWalletId ?? null,
    targetWalletId: input.targetWalletId ?? null,
    settlementId: null,
    adjustmentReason: null,
    notes: input.notes ?? null,
    externalRef: input.externalRef ?? null,
  };
}

export interface CreateIncomeInput {
  tripId: string;
  phaseId: string;
  /** The pool this income grows. */
  budgetPoolId: string;
  /** The wallet credited (null when the money isn't held in a tracked wallet). */
  walletId: string | null;
  amountCents: number;
  currency: string;
  /** E9: base-currency equivalent of a foreign-currency income; defaults to amount. */
  baseCurrencyAmountCents?: number;
  exchangeRate?: number | null;
  description: string;
  date?: string;
}

/**
 * B8 (DEC-212): real income received mid-trip — a reimbursement, a paycheck, a
 * top-up. Unlike F17's planned income (projection only), this is a REAL
 * transaction that GROWS the pool (`calculatePoolIncome`) and CREDITS its wallet
 * (`calculateWalletBalance`). It is never a personal cost and NEVER feeds value
 * learning (`excludeFromLearning` is always true — income is not an expense
 * pattern). Category is null (income isn't categorized like spending).
 */
export function createIncomeTransaction(input: CreateIncomeInput): Transaction {
  const now = new Date().toISOString();
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    phaseId: input.phaseId,
    budgetPoolId: input.budgetPoolId,
    walletId: input.walletId,
    sessionId: null,
    type: 'income' as TransactionType,
    amountCents: input.amountCents,
    personalCostCents: null,
    currency: input.currency,
    baseCurrencyAmountCents: input.baseCurrencyAmountCents ?? input.amountCents,
    exchangeRate: input.exchangeRate ?? null,
    category: null,
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: input.description,
    date: input.date ?? now,
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: true,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
  };
}

export interface CreateTransferInput {
  tripId: string;
  phaseId: string;
  sourceWalletId: string;
  targetWalletId: string;
  amountCents: number;
  currency: string;
  description: string;
  date?: string;
}

export function createTransferTransaction(input: CreateTransferInput): Transaction {
  const now = new Date().toISOString();
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    phaseId: input.phaseId,
    budgetPoolId: null,
    walletId: input.sourceWalletId,
    sessionId: null,
    type: 'transfer' as TransactionType,
    amountCents: input.amountCents,
    personalCostCents: null,
    currency: input.currency,
    baseCurrencyAmountCents: input.amountCents,
    exchangeRate: null,
    category: null,
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: input.description,
    date: input.date ?? now,
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: input.sourceWalletId,
    targetWalletId: input.targetWalletId,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
  };
}

export function createAdjustmentTransaction(
  tripId: string,
  phaseId: string,
  budgetPoolId: string,
  walletId: string | null,
  amountCents: number,
  currency: string,
  reason: string,
  category: TransactionCategory = 'reconciliation',
): Transaction {
  return {
    ...createSyncMetadata(),
    tripId,
    phaseId,
    budgetPoolId,
    walletId,
    sessionId: null,
    type: 'adjustment' as TransactionType,
    amountCents,
    personalCostCents: null,
    currency,
    baseCurrencyAmountCents: amountCents,
    exchangeRate: null,
    category,
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: reason,
    date: new Date().toISOString(),
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: true,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: reason,
    notes: null,
  };
}

export function filterTransactionsByPool(
  transactions: Transaction[],
  poolId: string,
): Transaction[] {
  return transactions.filter(
    (t) => t.budgetPoolId === poolId && t.deletedAt === null,
  );
}

export function filterTransactionsByPhase(
  transactions: Transaction[],
  phaseId: string,
): Transaction[] {
  return transactions.filter(
    (t) => t.phaseId === phaseId && t.deletedAt === null,
  );
}

export function filterTransactionsByCategory(
  transactions: Transaction[],
  category: string,
): Transaction[] {
  return transactions.filter(
    (t) => t.category === category && t.deletedAt === null,
  );
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  startDate: string,
  endDate: string,
): Transaction[] {
  return transactions.filter(
    (t) => t.deletedAt === null && t.date >= startDate && t.date <= endDate,
  );
}

export function getRecentTransactions(
  transactions: Transaction[],
  limit: number = 10,
): Transaction[] {
  return transactions
    .filter((t) => t.deletedAt === null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/**
 * DEC-088 (R-06): budget impact of a single local day ("YYYY-MM-DD") —
 * personal cost when available, same rule as calculatePoolSpent. E9: foreign
 * expenses contribute their base-currency value (the budget is in base).
 */
export function calculateSpentOnDate(
  transactions: Transaction[],
  dateIso: string,
): number {
  return transactions
    .filter(
      (t) =>
        t.deletedAt === null &&
        (t.type === 'expense' || t.type === 'adjustment') &&
        localDayOf(t.date) === dateIso,
    )
    .reduce((sum, t) => sum + transactionBasePersonalCostCents(t), 0);
}

export interface DayCategorySpend {
  /** Category key (`null` categories bucket into `'other'`). */
  category: string;
  totalCents: number;
  count: number;
}

/**
 * GATE 19: per-category breakdown of a single local day's spend. Uses the exact
 * same filter and base-personal-cost rule as `calculateSpentOnDate`, so the
 * categories always sum to that day's heatmap total. Sorted by spend desc; the
 * caller decides how many rows to show. Null categories bucket into `'other'`.
 */
export function spentByCategoryOnDate(
  transactions: Transaction[],
  dateIso: string,
): DayCategorySpend[] {
  const byCategory = new Map<string, { totalCents: number; count: number }>();
  transactions
    .filter(
      (t) =>
        t.deletedAt === null &&
        (t.type === 'expense' || t.type === 'adjustment') &&
        localDayOf(t.date) === dateIso,
    )
    .forEach((t) => {
      const key = t.category ?? 'other';
      const cents = transactionBasePersonalCostCents(t);
      const current = byCategory.get(key);
      if (current) {
        current.totalCents += cents;
        current.count += 1;
      } else {
        byCategory.set(key, { totalCents: cents, count: 1 });
      }
    });
  return [...byCategory.entries()]
    .map(([category, value]) => ({ category, ...value }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function groupTransactionsByCategory(
  transactions: Transaction[],
): Record<string, Transaction[]> {
  return transactions
    .filter((t) => t.deletedAt === null && t.category !== null)
    .reduce(
      (groups, t) => {
        const key = t.category!;
        if (!groups[key]) groups[key] = [];
        groups[key]!.push(t);
        return groups;
      },
      {} as Record<string, Transaction[]>,
    );
}
