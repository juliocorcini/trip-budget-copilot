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
  /**
   * DEC-400 (G1): when the event was explicitly STARTED ("iniciar evento"). A
   * started event is live (and stays live past its date) until it is explicitly
   * ended — it never disappears on its own (Â-EVENT-LIFECYCLE). Additive and
   * optional (legacy rows read back `undefined` ≡ never started → date-based
   * liveness, exactly the baseline).
   */
  startedAt?: string | null;
  /**
   * DEC-400 (G1): when the event was explicitly ENDED ("encerrar evento"). Marks
   * the event as no longer live and hands any unspent reserve to the leftover
   * flow (DEC-387) — distinct from `isConfirmed`, which only the leftover
   * resolution sets, so the held money is never auto-released (A4). Additive and
   * optional.
   */
  endedAt?: string | null;
  notes: string | null;
}
