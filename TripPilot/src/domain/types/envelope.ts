import type { SyncMetadata, EnvelopeKind } from './common';

export interface Envelope extends SyncMetadata {
  budgetPoolId: string;
  kind: EnvelopeKind;
  name: string;
  amountCents: number;
  notes: string | null;
}
