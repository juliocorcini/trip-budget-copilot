import type { SyncMetadata, ShareType } from './common';

/** DEC-071: explicit confirmation state for shared expense shares. */
export type ShareConfirmationStatus = 'pending' | 'confirmed' | 'rejected';

export interface ParticipantShare extends SyncMetadata {
  transactionId: string;
  participantId: string;
  shareAmountCents: number;
  shareType: ShareType;
  isPaid: boolean;
  /** DEC-071: creator's share is born confirmed; third-party shares pending. */
  confirmationStatus: ShareConfirmationStatus;
  notes: string | null;
}
