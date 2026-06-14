import { localDateString } from '@/domain/dates';
import { normalizeBackupToV5, type BackupData } from '@/domain/backup';
import type { LocalSnapshot } from '@/domain/types/local-snapshot';

// E6 (M14): pure helpers for the local "restore to yesterday" history. All
// logic here is side-effect free so it can be unit-tested directly; the
// boundary (DB read/write, prune) lives in utils/local-snapshot.ts.

/** Keep at most this many daily restore points — older ones are pruned. */
export const MAX_LOCAL_SNAPSHOTS = 7;

/** The day key used as a snapshot id — one restore point per local day. */
export function snapshotDayId(date: Date = new Date()): string {
  return localDateString(date);
}

/** Snapshots newest-first by capture time (non-mutating copy). */
export function sortSnapshotsNewestFirst(snapshots: LocalSnapshot[]): LocalSnapshot[] {
  return [...snapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** True when a restore point already exists for the given day (1×/day guard). */
export function hasSnapshotForDay(snapshots: LocalSnapshot[], dayId: string): boolean {
  return snapshots.some((snapshot) => snapshot.id === dayId);
}

/**
 * The snapshots to delete so only the N newest remain. Returns the "losers"
 * (everything past the cap, oldest first is irrelevant — callers delete by id).
 */
export function selectSnapshotsToPrune(
  snapshots: LocalSnapshot[],
  maxCount: number = MAX_LOCAL_SNAPSHOTS,
): LocalSnapshot[] {
  return sortSnapshotsNewestFirst(snapshots).slice(maxCount);
}

/** Parses a stored payload into a current-version backup (null on bad JSON). */
export function parseSnapshotJson(json: string): BackupData | null {
  try {
    return normalizeBackupToV5(JSON.parse(json) as BackupData);
  } catch {
    return null;
  }
}
