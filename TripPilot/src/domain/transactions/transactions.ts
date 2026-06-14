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
    excludeFromLearning: false,
    sourceWalletId: input.sourceWalletId ?? null,
    targetWalletId: input.targetWalletId ?? null,
    settlementId: null,
    adjustmentReason: null,
    notes: input.notes ?? null,
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
