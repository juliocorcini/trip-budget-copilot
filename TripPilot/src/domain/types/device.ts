import type { SyncMetadata } from './common';

export interface Device extends SyncMetadata {
  name: string;
  lastSeenAt: string;
}
