import type { SyncMetadata } from './common';

/** DEC-072: a one-off event (party, show) or a sub-destination (eurotrip city). */
export type OccurrenceKind = 'event' | 'sub_destination';

export interface PlannedOccurrence extends SyncMetadata {
  tripId: string;
  phaseId: string;
  /** DEC-072: nullable — events do not require an activity profile. */
  activityProfileId: string | null;
  budgetPoolId: string;
  name: string;
  plannedDate: string | null;
  /** DEC-072: null = single-day; set = multi-day interval end. */
  endDate: string | null;
  kind: OccurrenceKind;
  estimatedCostCents: number;
  /** DEC-072: deducts from freeToSpend until confirmed/linked to a session. */
  reservedCents: number | null;
  isConfirmed: boolean;
  linkedTransactionId: string | null;
  /** DEC-072: bridge to the Outing Mode session started from this event. */
  linkedSessionId: string | null;
  notes: string | null;
}
