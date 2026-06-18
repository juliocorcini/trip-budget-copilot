import { useMemo } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { hasWiseImportedTransactions, isWalletTrackingActive } from '@/domain/wallets';

/**
 * GATE 5 (D10): whether the "de onde saiu o dinheiro?" wallet question should be
 * shown. Invisible for a single-source traveler; lights up automatically with
 * 2+ wallets or a Wise import; the manual override in Settings wins. Reads the
 * shared app-data snapshot so every spend surface stays consistent.
 */
export function useWalletTracking(): boolean {
  const { wallets, transactions, settings } = useAppData();
  return useMemo(
    () =>
      isWalletTrackingActive(
        wallets,
        settings?.walletTrackingOverride ?? null,
        hasWiseImportedTransactions(transactions),
      ),
    [wallets, transactions, settings?.walletTrackingOverride],
  );
}
