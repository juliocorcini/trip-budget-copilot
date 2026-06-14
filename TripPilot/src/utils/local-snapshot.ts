import { appSettingsRepository, localSnapshotRepository } from '@/data/repositories';
import { buildFullBackup, importBackup } from '@/domain/orchestrators';
import {
  MAX_LOCAL_SNAPSHOTS,
  hasSnapshotForDay,
  selectSnapshotsToPrune,
  snapshotDayId,
  parseSnapshotJson,
} from '@/domain/local-snapshots';
import type { LocalSnapshot } from '@/domain/types/local-snapshot';

// E6 (M14/M15): boundary for the local "restore to yesterday" history. Reuses
// the same backup machinery as the emergency snapshot, but persists a rolling
// window of daily restore points in a Dexie table (localStorage cannot hold N
// full backups). Both functions are best-effort and never crash a save flow.

/**
 * M14: once per local day, capture a full backup as a restore point and prune to
 * the N newest. De-duplicates by day so a busy session never re-serializes the
 * whole DB. Reuses the expense trigger (called alongside recordExpenseForSnapshot)
 * but writes at most daily. Never throws.
 */
export async function recordDailyLocalSnapshot(): Promise<void> {
  try {
    const settings = await appSettingsRepository.get();
    // Nothing worth protecting until the user actually has a trip.
    if (!settings.activeTrip) return;

    const today = snapshotDayId();
    const existing = await localSnapshotRepository.getAll();
    if (hasSnapshotForDay(existing, today)) return;

    const backup = await buildFullBackup(settings);
    const snapshot: LocalSnapshot = {
      id: today,
      createdAt: new Date().toISOString(),
      expenseCount: backup.transactions?.length ?? 0,
      json: JSON.stringify(backup),
    };
    await localSnapshotRepository.put(snapshot);

    const toPrune = selectSnapshotsToPrune([snapshot, ...existing], MAX_LOCAL_SNAPSHOTS);
    await localSnapshotRepository.bulkDelete(toPrune.map((s) => s.id));
  } catch {
    // Boundary failure (DB read / quota) — file backup + emergency snapshot
    // remain available, so we swallow the error and keep the save flow smooth.
  }
}

/**
 * M15: restore the DB to a stored restore point, reusing the atomic backup
 * import (replace mode — single Dexie transaction, no partial writes). Returns
 * false when the payload is unreadable so the caller can surface a clear error.
 */
export async function restoreLocalSnapshot(snapshot: LocalSnapshot): Promise<boolean> {
  const backup = parseSnapshotJson(snapshot.json);
  if (!backup) return false;
  await importBackup(backup, 'replace');
  return true;
}
