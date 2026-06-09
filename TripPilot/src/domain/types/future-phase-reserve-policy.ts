import type { SyncMetadata } from './common';

export interface FuturePhaseReservePolicy extends SyncMetadata {
  budgetPoolId: string;
  phaseId: string;
  minimumReserveCents: number;
  autoCalculate: boolean;
  notes: string | null;
}
