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

export function calculateWalletBalance(
  wallet: Wallet,
  transactions: Transaction[],
): WalletBalance {
  const active = transactions.filter((t) => t.deletedAt === null);

  const outgoingCents = sumCents(
    active
      .filter(
        (t) =>
          t.walletId === wallet.id &&
          (t.type === 'expense' || t.type === 'adjustment'),
      )
      .map((t) => t.amountCents),
  );

  const transferOut = sumCents(
    active
      .filter(
        (t) => t.type === 'transfer' && t.sourceWalletId === wallet.id,
      )
      .map((t) => t.amountCents),
  );

  const transferIn = sumCents(
    active
      .filter(
        (t) => t.type === 'transfer' && t.targetWalletId === wallet.id,
      )
      .map((t) => t.amountCents),
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
