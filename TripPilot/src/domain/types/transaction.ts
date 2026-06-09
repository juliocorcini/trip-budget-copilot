import type { SyncMetadata, TransactionType } from './common';

export interface Transaction extends SyncMetadata {
  tripId: string;
  phaseId: string;
  budgetPoolId: string | null;
  walletId: string | null;
  sessionId: string | null;
  type: TransactionType;
  amountCents: number;
  personalCostCents: number | null;
  currency: string;
  baseCurrencyAmountCents: number;
  exchangeRate: number | null;
  category: string | null;
  description: string;
  date: string;
  isShared: boolean;
  paidByParticipantId: string | null;
  activityProfileId: string | null;
  isSpecialOccasion: boolean;
  excludeFromLearning: boolean;
  sourceWalletId: string | null;
  targetWalletId: string | null;
  settlementId: string | null;
  adjustmentReason: string | null;
  notes: string | null;
}
