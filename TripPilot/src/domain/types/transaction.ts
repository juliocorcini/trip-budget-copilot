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
  /**
   * DEC-367 (G8): provenance of `placeLabel`. `'user'` = the traveler opened
   * "detalhes" and chose/confirmed the place (verified). `'auto'` = the app
   * reverse-geocoded a PROBABLE name on the save path without confirmation
   * (shown as "provavelmente {name}"). null/undefined = no name or a legacy
   * record. Additive + NOT indexed (no Dexie migration).
   */
  placeNameSource?: 'auto' | 'user' | null;
  /** DEC-367 (G8): GPS accuracy in meters at capture, when known. Additive. */
  locationAccuracy?: number | null;
  /** DEC-367 (G8): ISO timestamp of the coordinate capture. Additive. */
  locationCapturedAt?: string | null;
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
  /**
   * DEC-200 (Wise import): provenance of an externally imported record, e.g.
   * `wise:CARD-3927313014`. The cross-source dedupe key. Optional + NOT indexed
   * → additive, no Dexie migration; records predating the import feature read
   * back `undefined` (treated as "no external source"). Rides along in backups
   * via the transaction schema's `.passthrough()`.
   */
  externalRef?: string | null;
  /**
   * DEC-386 (G1): explicit link to the PlannedOccurrence (event) this spend was
   * attributed to — the way to "spend from an event" WITHOUT the active outing.
   * A spend belongs to an event XOR a session, never both (Â-ATTRIBUTION): when
   * `occurrenceId` is set, `sessionId` is forced null in the factory. Optional +
   * NOT indexed (no Dexie migration); legacy records read back `undefined`
   * (treated as "no event"). Rides backups via the schema's `.passthrough()`.
   */
  occurrenceId?: string | null;
}
