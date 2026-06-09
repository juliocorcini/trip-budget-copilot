import type { SyncMetadata, SessionStatus } from './common';

export interface Session extends SyncMetadata {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  activityProfileId: string;
  status: SessionStatus;
  name: string;
  targetCents: number | null;
  ceilingCents: number | null;
  maxCents: number | null;
  startedAt: string;
  endedAt: string | null;
  quickAddValuesCents: number[];
  avgDrinkPriceCents: number | null;
  notes: string | null;
}

export interface SessionItem extends SyncMetadata {
  sessionId: string;
  transactionId: string;
  order: number;
}
