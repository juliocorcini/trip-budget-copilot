import type { SyncMetadata, ConfidenceLevel } from './common';

export interface ForecastSnapshot extends SyncMetadata {
  tripId: string;
  phaseId: string;
  snapshotDate: string;
  totalBudgetCents: number;
  totalSpentCents: number;
  freeToSpendCents: number;
  avgDailySpendCents: number;
  projectedEndSpendCents: number;
  confidence: ConfidenceLevel;
  notes: string | null;
}
