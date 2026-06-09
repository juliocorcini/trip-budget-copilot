import { db } from '@/data/db/database';
import {
  createTransferTransaction,
  createAdjustmentTransaction,
} from '@/domain/transactions';
import { calculateCashReconciliation } from '@/domain/wallets';
import type { Transaction } from '@/domain/types/transaction';
import type { TransactionCategory } from '@/domain/types/common';

export interface TransferInput {
  tripId: string;
  phaseId: string;
  sourceWalletId: string;
  targetWalletId: string;
  amountCents: number;
  currency: string;
  description: string;
}

/**
 * Moves money between wallets. Never touches the budget:
 * budgetPoolId = null, personalCostCents = null (Core Rule 3 / DEC-052).
 */
export async function transferBetweenWallets(input: TransferInput): Promise<Transaction> {
  if (input.sourceWalletId === input.targetWalletId) {
    throw new Error('Source and target wallets must differ');
  }
  const tx = createTransferTransaction(input);
  await db.transactions.add(tx);
  return tx;
}

/**
 * Cash withdrawal = bank wallet → cash wallet transfer (Core Rule 3).
 * Semantically identical to a transfer; kept as a named flow for clarity.
 */
export async function withdrawCash(input: TransferInput): Promise<Transaction> {
  return transferBetweenWallets(input);
}

export interface ReconcileWalletInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  walletId: string;
  expectedBalanceCents: number;
  countedBalanceCents: number;
  currency: string;
  reason: string;
  category?: TransactionCategory;
}

/**
 * DEC-052: counted < expected → positive adjustment (untracked spending,
 * reduces budget and wallet). counted > expected → negative adjustment
 * (correction, increases wallet, gives budget back).
 * Returns null when balances already match.
 */
export async function reconcileWallet(input: ReconcileWalletInput): Promise<Transaction | null> {
  const result = calculateCashReconciliation(
    input.expectedBalanceCents,
    input.countedBalanceCents,
  );
  if (!result.needsAdjustment) return null;

  // differenceCents = counted - expected. Missing cash (< 0) means money was
  // spent untracked → adjustment amount is positive (counts as spending).
  const adjustmentCents = -result.differenceCents;
  const tx = createAdjustmentTransaction(
    input.tripId,
    input.phaseId,
    input.budgetPoolId,
    input.walletId,
    adjustmentCents,
    input.currency,
    input.reason,
    input.category ?? 'reconciliation',
  );
  await db.transactions.add(tx);
  return tx;
}
