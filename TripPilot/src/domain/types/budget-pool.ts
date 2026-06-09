import type { SyncMetadata, BudgetPoolScope } from './common';

export interface BudgetPool extends SyncMetadata {
  tripId: string;
  name: string;
  scope: BudgetPoolScope;
  totalAmountCents: number;
  currency: string;
  notes: string | null;
}
