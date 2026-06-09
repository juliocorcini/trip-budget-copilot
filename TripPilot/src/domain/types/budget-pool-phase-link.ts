import type { SyncMetadata } from './common';

export interface BudgetPoolPhaseLink extends SyncMetadata {
  budgetPoolId: string;
  phaseId: string;
  futureFloorCents: number | null;
}
