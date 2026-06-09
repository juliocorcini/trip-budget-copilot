import type { SyncMetadata, WalletType } from './common';

export interface Wallet extends SyncMetadata {
  tripId: string;
  name: string;
  walletType: WalletType;
  currency: string;
  initialBalanceCents: number;
  isDefault: boolean;
  notes: string | null;
}
