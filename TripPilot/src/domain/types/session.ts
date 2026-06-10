import type { SyncMetadata, SessionStatus } from './common';

export interface Session extends SyncMetadata {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** Null for one-off event sessions (DEC-073): no recurring profile involved. */
  activityProfileId: string | null;
  status: SessionStatus;
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
