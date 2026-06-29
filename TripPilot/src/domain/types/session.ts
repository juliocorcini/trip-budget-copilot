import type { SyncMetadata, SessionStatus } from './common';

export interface Session extends SyncMetadata {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** Null for one-off event sessions (DEC-073): no recurring profile involved. */
  activityProfileId: string | null;
  status: SessionStatus;
  /**
   * DEC-400 (G1): the event this outing belongs to, when it was started FROM a
   * live event ("iniciar saída"). Additive and optional (legacy/import rows read
   * back `undefined`): an event owns N outings over time via this back-link,
   * while the legacy 1:1 `PlannedOccurrence.linkedSessionId` still counts as one
   * of them. A spend is event XOR session (Â-ATTRIBUTION), so summing the
   * outings' spend into the event reserve never double counts.
   */
  occurrenceId?: string | null;
  name: string;
  targetCents: number | null;
  ceilingCents: number | null;
  maxCents: number | null;
  startedAt: string;
  endedAt: string | null;
  quickAddValuesCents: number[];
  avgDrinkPriceCents: number | null;
  /** Alert milestones (50/75/90/100) already fired — never repeat (DEC-048). */
  firedAlertPercents: number[];
  /** Timestamp of the last over-max confirmation (DEC-053b, 15min window). */
  overMaxConfirmedAt: string | null;
  notes: string | null;
}

export interface SessionItem extends SyncMetadata {
  sessionId: string;
  transactionId: string;
  order: number;
}
