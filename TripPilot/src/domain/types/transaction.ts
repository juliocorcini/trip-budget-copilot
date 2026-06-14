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
  /** DEC-095 (R-13): expense-taxonomy id (e.g. `bar_drink`). NOT indexed. */
  subcategoryId: string | null;
  /**
   * E8 (Phase 5): location context — where the expense happened. All fields are
   * NOT indexed (no Dexie migration). Captured opt-in via GPS or typed manually;
   * the original currency/value is preserved separately (multi-currency). null
   * when location capture is off or the place is unknown.
   */
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
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
