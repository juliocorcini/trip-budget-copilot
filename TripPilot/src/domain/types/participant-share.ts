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
  /**
   * DEC-414 (G6): when this share's debt was MOVED from another person (by
   * reassigning it A→B), the id of the ORIGINAL debtor — so the recipient's
   * statement can show "moved from {name}" and the move can be undone. Null for a
   * share that was never reassigned. Additive and non-indexed (no schema change;
   * backup passes it through unchanged).
   */
  reassignedFrom?: string | null;
}
