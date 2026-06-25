import type { SyncMetadata } from './common';
import type { GroupSplitEvent, GroupSplitStatus } from '@/domain/group-split/types';

/**
 * C23 / DEC-297 — the durable form of a Tricount group split (table
 * `groupSplitEvents`). Like `SplitRecord` wraps a `SplitSession`, this wraps the
 * pure `GroupSplitEvent` aggregate with sync metadata. `record.id` mirrors
 * `event.id`; the top-level `tripId`/`status` are indexed projections so the list
 * and trip-scoped lookups never parse the embedded JSON.
 *
 * It IS backed up (the rich group history is the retention asset — the same
 * policy as `SplitRecord`), so a device restore keeps every past event.
 */
export interface GroupSplitRecord extends SyncMetadata {
  /** Mirrors event.tripId — indexed for "this trip's group splits". Null = standalone. */
  tripId: string | null;
  /** Mirrors event.status — indexed for open/settled filtering. */
  status: GroupSplitStatus;
  /** The full readable group aggregate. */
  event: GroupSplitEvent;
}
