import type { SyncMetadata } from './common';

export interface PlannedOccurrence extends SyncMetadata {
  tripId: string;
  phaseId: string;
  activityProfileId: string;
  budgetPoolId: string;
  name: string;
  plannedDate: string | null;
  estimatedCostCents: number;
  isConfirmed: boolean;
  linkedTransactionId: string | null;
  notes: string | null;
}
