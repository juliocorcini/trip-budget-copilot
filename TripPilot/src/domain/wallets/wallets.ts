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

  // B8 (DEC-212): real income credits the wallet it lands in — additive, so a
  // wallet with no income reads exactly as before.
  const incomeIn = sumCents(
    active
      .filter((t) => t.type === 'income' && t.walletId === wallet.id)
      .map(debit),
  );

  const incomingCents = transferIn + incomeIn;
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

/**
 * DEC-473 — the app-wide wallet auto-assignment policy ("pente fino"): no flow
 * may persist `walletId: null` silently. The resolution order is:
 *  1. the explicitly marked default wallet (Settings), when alive;
 *  2. the ONLY live wallet, when there is exactly one (nothing to ask);
 *  3. `null` — ambiguous (2+ wallets, none default): the UI must ASK, and only
 *     an explicit "no wallet" choice by the user may persist null.
 */
export function resolveAutoWallet(wallets: Wallet[]): Wallet | null {
  const explicit = getDefaultWallet(wallets);
  if (explicit) return explicit;
  const live = wallets.filter((w) => w.deletedAt === null);
  return live.length === 1 ? live[0]! : null;
}

/** Convenience id form of {@link resolveAutoWallet} for transaction stamping. */
export function resolveAutoWalletId(wallets: Wallet[]): string | null {
  return resolveAutoWallet(wallets)?.id ?? null;
}

export function getUnassignedTransactionCount(transactions: Transaction[]): number {
  return transactions.filter(
    (t) =>
      t.deletedAt === null &&
      t.walletId === null &&
      t.type === 'expense',
  ).length;
}

const WISE_EXTERNAL_REF_PREFIX = 'wise:';

/**
 * GATE 5 (D10): a trip "has a Wise import" once any live transaction carries a
 * Wise external ref (the re-import dedupe key set by `wiseExternalRef`). Pure
 * read over the ledger — soft-deleted rows do not count.
 */
export function hasWiseImportedTransactions(transactions: Transaction[]): boolean {
  return transactions.some(
    (t) =>
      t.deletedAt === null &&
      typeof t.externalRef === 'string' &&
      t.externalRef.startsWith(WISE_EXTERNAL_REF_PREFIX),
  );
}

/** GATE 5: how many live (non-deleted) wallets — the count of money sources. */
export function countActiveWallets(wallets: Wallet[]): number {
  return wallets.filter((w) => w.deletedAt === null).length;
}

/**
 * GATE 5 / D10 — progressive wallet tracking. The "de onde saiu o dinheiro?"
 * question stays INVISIBLE for a single-source traveler and lights up
 * automatically once there are 2+ wallets OR a Wise import exists. The manual
 * override from Settings wins over the automatic rule so the traveler is never
 * trapped either way:
 * - `null`  → automatic (2+ wallets or a Wise import);
 * - `true`  → always on;
 * - `false` → always off.
 */
export function isWalletTrackingActive(
  wallets: Wallet[],
  walletTrackingOverride: boolean | null,
  hasWiseImport: boolean,
): boolean {
  if (walletTrackingOverride !== null) return walletTrackingOverride;
  return countActiveWallets(wallets) >= 2 || hasWiseImport;
}
