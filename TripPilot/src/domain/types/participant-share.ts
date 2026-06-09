import type { SyncMetadata, ShareType } from './common';

export interface ParticipantShare extends SyncMetadata {
  transactionId: string;
  participantId: string;
  shareAmountCents: number;
  shareType: ShareType;
  isPaid: boolean;
  notes: string | null;
}
