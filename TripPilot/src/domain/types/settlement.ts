import type { SyncMetadata } from './common';
import type { SettlementMethod } from '@/domain/payment/payment-methods';

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
  /**
   * FB-27 (DEC-277): how the repayment was made (pix/wise/bank/cash/other).
   * Structured (not free text) so the data can later power summaries. Optional
   * + NOT indexed → additive, no migration; pre-existing settlements and the
   * Wise import (DEC-200) read back `undefined`. Rides along in backups via the
   * `.passthrough()` settlement schema.
   */
  method?: SettlementMethod | null;
}
