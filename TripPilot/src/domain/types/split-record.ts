import type { SyncMetadata } from './common';
import type { SplitSession, SplitStatus } from '@/domain/split/types';

/**
 * T16 — the persisted, readable form of a bill division (table `splitSessions`).
 * It is the durable counterpart of the in-memory `SplitSession`:
 *  - while a division is in progress it stores the `draft`/`live` snapshot so the
 *    owner can resume after an app restart (and stay the single source of truth
 *    for the live-link / hybrid transports — DEC-106 owner-reducer);
 *  - once committed it keeps the full readable division (items, who took what,
 *    tax mode/source, participants, read total) linked to the created `Session`,
 *    so "open the expense and see the whole split" (T1) is one row, not a
 *    re-derivation from transactions.
 *
 * It IS backed up (unlike share-link secrets): the rich record is the retention
 * asset, so a device restore keeps every past division. `splitMeta` holds the
 * entire `SplitSession`; the top-level `tripId`/`sessionId`/`status` are indexed
 * projections of it so the common lookups never have to parse the JSON.
 */
export interface SplitRecord extends SyncMetadata {
  /** Mirrors splitMeta.tripId — indexed for "this trip's divisions". Null = ad-hoc. */
  tripId: string | null;
  /** The committed Session this describes; null while draft/live. Indexed for reverse lookup. */
  sessionId: string | null;
  /** Mirrors splitMeta.status — indexed for "resume my live drafts". */
  status: SplitStatus;
  /** The full readable division snapshot (T16). */
  splitMeta: SplitSession;
}
