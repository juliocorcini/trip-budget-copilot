import type { SyncMetadata } from './common';

export interface Phase extends SyncMetadata {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  order: number;
  notes: string | null;
}
