import type { Wallet } from '@/domain/types/wallet';
import type { Transaction } from '@/domain/types/transaction';
import { sumCents } from '@/domain/money';

export interface WalletBalance {
  walletId: string;
  walletName: string;
  initialBalanceCents: number;
  incomingCents: number;
  outgoingCents: number;
  currentBalanceCents: number;
}

/**
 * E9 (M10): the amount a transaction moves in the WALLET's own currency. A
 * wallet holds one currency, so a foreign expense cannot debit its raw number:
 * - same currency as the wallet → the original amount;
 * - wallet is in the base currency → the converted (base) amount;
 * - triple-edge (wallet neither base nor the expense's currency) is out of
 *   scope: we assume the wallet is in base or in the expense's currency and
 *   fall back to the original amount (documented limitation — ÂNCORA 11/15).
 */
export function transactionWalletAmountCents(
  transaction: Transaction,
  walletCurrency: string,
  baseCurrency: string,
): number {
  if (transaction.currency === walletCurrency) return transaction.amountCents;
  if (walletCurrency === baseCurrency) return transaction.baseCurrencyAmountCents;
  return transaction.amountCents;
}

export function calculateWalletBalance(
  wallet: Wallet,
  transactions: Transaction[],
  baseCurrency: string,
): WalletBalance {
  const active = transactions.filter((t) => t.deletedAt === null);
  const debit = (t: Transaction) =>
    transactionWalletAmountCents(t, wallet.currency, baseCurrency);

  const outgoingCents = sumCents(
    active
      .filter(
        (t) =>
          t.walletId === wallet.id &&
          (t.type === 'expense' || t.type === 'adjustment'),
      )
      .map(debit),
  );

  const transferOut = sumCents(
    active
      .filter(
        (t) => t.type === 'transfer' && t.sourceWalletId === wallet.id,
      )
      .map(debit),
  );

  const transferIn = sumCents(
    active
      .filter(
        (t) => t.type === 'transfer' && t.targetWalletId === wallet.id,
      )
      .map(debit),
  );

  const incomingCents = transferIn;
  const totalOutgoing = outgoingCents + transferOut;
  const currentBalanceCents =
    wallet.initialBalanceCents + incomingCents - totalOutgoing;

  return {
    walletId: wallet.id,
    walletName: wallet.name,
    initialBalanceCents: wallet.initialBalanceCents,
    incomingCents,
    outgoingCents: totalOutgoing,
    currentBalanceCents,
  };
}

export function calculateCashReconciliation(
  expectedCents: number,
  countedCents: number,
): { differenceCents: number; needsAdjustment: boolean } {
  const differenceCents = countedCents - expectedCents;
  return {
    differenceCents,
    needsAdjustment: differenceCents !== 0,
  };
}

export function getDefaultWallet(wallets: Wallet[]): Wallet | null {
  return (
    wallets.find((w) => w.isDefault && w.deletedAt === null) ?? null
  );
}

export function getUnassignedTransactionCount(transactions: Transaction[]): number {
  return transactions.filter(
    (t) =>
      t.deletedAt === null &&
      t.walletId === null &&
      t.type === 'expense',
  ).length;
}
