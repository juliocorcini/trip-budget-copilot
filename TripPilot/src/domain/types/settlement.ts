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
  /**
   * FIELD-14 (DEC-200): provenance when a settlement was created from an
   * imported Wise transfer (e.g. `wise:TRANSFER-2188321339`). The cross-source
   * dedupe key for re-imports. Optional + NOT indexed → additive, no migration;
   * pre-existing settlements read back `undefined`. Rides along in backups.
   */
  externalRef?: string | null;
}
