import type { SyncMetadata, TripStatus } from './common';

export interface Trip extends SyncMetadata {
  name: string;
  baseCurrency: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  notes: string | null;
}
