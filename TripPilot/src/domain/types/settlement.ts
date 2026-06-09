import type { SyncMetadata } from './common';

export interface Settlement extends SyncMetadata {
  tripId: string;
  debtorParticipantId: string;
  creditorParticipantId: string;
  amountCents: number;
  currency: string;
  settledAt: string;
  linkedTransactionId: string | null;
  notes: string | null;
}
