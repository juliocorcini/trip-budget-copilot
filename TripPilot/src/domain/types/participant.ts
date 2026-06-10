import type { SyncMetadata } from './common';

export interface Participant extends SyncMetadata {
  tripId: string;
  name: string;
  nickname: string | null;
  isOwner: boolean;
  email: string | null;
  linkedUserAccountId: string | null;
  /** DEC-105: actor id of the paired device (QR pairing), null when local-only. */
  linkedActorId: string | null;
}
