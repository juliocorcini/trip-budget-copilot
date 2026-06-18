import type { SyncMetadata, BudgetPoolScope } from './common';

export interface BudgetPool extends SyncMetadata {
  tripId: string;
  name: string;
  scope: BudgetPoolScope;
  totalAmountCents: number;
  currency: string;
  notes: string | null;
  /**
   * GATE 3 (D7): a "Pote" is a `global`-scope pool with these OPTIONAL extras.
   * `dateStart`/`dateEnd` (inclusive YYYY-MM-DD) anchor a pot to a moment — they
   * drive the D8 Home visibility rule (a dated pot only surfaces in its owner
   * trecho or within the D-7 window). `goalCents` is an optional savings target
   * for a progress bar. All three are OPTIONAL on the type so records that
   * predate the field (and `linked_phases` trecho pools) stay valid; the Dexie
   * v10 upgrade backfills them to null, and the factory always sets them.
   */
  dateStart?: string | null;
  dateEnd?: string | null;
  goalCents?: number | null;
}
