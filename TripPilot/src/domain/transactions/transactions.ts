import type { Transaction } from '@/domain/types/transaction';
import type { TransactionType, TransactionCategory } from '@/domain/types/common';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface CreateExpenseInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  walletId: string | null;
  amountCents: number;
  currency: string;
  category: string;
  description: string;
  date?: string;
  isShared?: boolean;
  paidByParticipantId?: string | null;
  activityProfileId?: string | null;
  sessionId?: string | null;
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
    type: 'expense' as TransactionType,
    amountCents: input.amountCents,
    personalCostCents: input.isShared ? null : input.amountCents,
    currency: input.currency,
    baseCurrencyAmountCents: input.amountCents,
    exchangeRate: null,
    category: input.category,
    description: input.description,
    date: input.date ?? now,
    isShared: input.isShared ?? false,
    paidByParticipantId: input.paidByParticipantId ?? null,
    activityProfileId: input.activityProfileId ?? null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
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
    category: 'reconciliation' as TransactionCategory,
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
