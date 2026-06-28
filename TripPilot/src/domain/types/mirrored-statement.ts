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

/**
 * DEC-399 — a debt the owner recorded that does NOT involve the owner (e.g.
 * "Débora owes you"). Display-only on the mirror: never part of the headline
 * `netCents`, never answerable — just shown so the guest sees what the owner has
 * on record about them with other people.
 */
export interface MirroredThirdPartyGroup {
  counterpartyId: string;
  counterpartyName: string;
  netCents: number;
  lines: MirroredLine[];
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
  /**
   * DEC-207 — origin when this statement arrived via a shared link (vs QR/mailbox
   * pairing). Lets the guest re-pull updates and push responses to the same
   * channel. Optional + NOT indexed → additive, no migration; QR/mailbox
   * statements read back `undefined`.
   */
  share?: { shareId: string; key: string } | null;
  /**
   * DEC-399 — display-only debts the owner recorded that don't involve the owner.
   * Optional + additive; QR/older statements read back `undefined`.
   */
  thirdParty?: MirroredThirdPartyGroup[] | null;
}
