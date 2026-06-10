import type { SyncMetadata } from './common';

/**
 * DEC-106 (owner/mirror): a read-only snapshot of "what I owe / am owed"
 * received from a paired owner device. Never merged into local financial
 * data — the mirror can only answer confirm/reject per line.
 */

export interface MirroredLine {
  shareId: string;
  transactionId: string;
  /** From the mirror's point of view: 'owes' = I owe the owner. */
  kind: 'owes' | 'is_owed';
  description: string | null;
  category: string | null;
  subcategoryId: string | null;
  occurredAt: string;
  amountCents: number;
  counterpartyName: string;
  confirmationStatus: 'pending' | 'confirmed' | 'rejected';
}

export interface MirroredResponse {
  shareId: string;
  status: 'confirmed' | 'rejected';
}

export interface MirroredStatement extends SyncMetadata {
  peerActorId: string;
  peerName: string;
  receivedAt: string;
  currency: string;
  netCents: number;
  lines: MirroredLine[];
  /** Confirm/reject answers queued while offline; flushed on the next session. */
  pendingResponses: MirroredResponse[];
}
