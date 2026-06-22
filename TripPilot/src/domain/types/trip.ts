import type { SyncMetadata, TripStatus, TripKind } from './common';

export interface Trip extends SyncMetadata {
  name: string;
  baseCurrency: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  /**
   * DEC-250: regular dated trip (`'trip'`, the default) or a continuous
   * "Dia a dia" space (`'ongoing'`). Optional so existing records — which never
   * carried this field — read as a trip via `tripKind()`; no migration.
   */
  kind?: TripKind;
  notes: string | null;
}
