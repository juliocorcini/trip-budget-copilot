import type { SyncMetadata } from './common';

export interface Participant extends SyncMetadata {
  tripId: string;
  name: string;
  nickname: string | null;
  isOwner: boolean;
  email: string | null;
  linkedUserAccountId: string | null;
}
