import { safeLocalStorage } from '@/utils/safe-storage';
import { appSettingsRepository } from '@/data/repositories';
import { buildFullBackup } from '@/domain/orchestrators';
import { normalizeBackupToV6, type BackupData } from '@/domain/backup';

// BUG-002: iOS can evict IndexedDB without warning. As a last line of defense
// we keep a full JSON snapshot in localStorage (a separate storage area that
// survives an IndexedDB wipe). It is written every few expenses and whenever an
// outing ends; on the next boot, if the database comes up empty but a snapshot
// exists, BootGate offers a one-tap restore.

const SNAPSHOT_KEY = 'trippilot.emergency-snapshot';
const COUNTER_KEY = 'trippilot.emergency-snapshot-counter';

// Write at most once every N expenses to avoid serializing the whole DB on
// every tap during a busy session.
const SNAPSHOT_INTERVAL = 5;

// localStorage caps around 5 MB; refuse to even try past this so we never spend
// time serializing a backup that cannot be stored (file backup covers big DBs).
const MAX_SNAPSHOT_BYTES = 2_500_000;

export interface EmergencySnapshotMeta {
  exportedAt: string;
  tripCount: number;
  transactionCount: number;
}

/** Builds and stores a full snapshot now. Never throws; returns success. */
export async function writeEmergencySnapshot(): Promise<boolean> {
  try {
    const settings = await appSettingsRepository.get();
    // Nothing worth protecting until the user actually has a trip.
    if (!settings.activeTrip) return false;
    const backup = await buildFullBackup(settings);
    const serialized = JSON.stringify(backup);
    if (serialized.length > MAX_SNAPSHOT_BYTES) return false;
    safeLocalStorage.set(SNAPSHOT_KEY, serialized);
    return true;
  } catch {
    // Boundary failure (DB read / quota) — the in-app backup remains available.
    return false;
  }
}

/**
 * Counter-based trigger: writes a snapshot once every SNAPSHOT_INTERVAL calls.
 * The counter resets when the threshold is reached (whether or not the write
 * succeeds) so a too-large DB never makes us rebuild a backup on every expense.
 */
export async function recordExpenseForSnapshot(): Promise<void> {
  const next = Number(safeLocalStorage.get(COUNTER_KEY) ?? '0') + 1;
  if (next < SNAPSHOT_INTERVAL) {
    safeLocalStorage.set(COUNTER_KEY, String(next));
    return;
  }
  safeLocalStorage.set(COUNTER_KEY, '0');
  await writeEmergencySnapshot();
}

export function hasEmergencySnapshot(): boolean {
  return safeLocalStorage.get(SNAPSHOT_KEY) !== null;
}

/** Parses the stored snapshot, normalized to the current backup version. */
export function readEmergencySnapshot(): BackupData | null {
  const raw = safeLocalStorage.get(SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return normalizeBackupToV6(JSON.parse(raw) as BackupData);
  } catch {
    return null;
  }
}

/** Lightweight header for the restore screen — avoids re-parsing for the UI. */
export function readEmergencySnapshotMeta(): EmergencySnapshotMeta | null {
  const snapshot = readEmergencySnapshot();
  if (!snapshot) return null;
  return {
    exportedAt: snapshot.exportedAt,
    tripCount: snapshot.trips?.length ?? 0,
    transactionCount: snapshot.transactions?.length ?? 0,
  };
}

export function clearEmergencySnapshot(): void {
  safeLocalStorage.remove(SNAPSHOT_KEY);
  safeLocalStorage.remove(COUNTER_KEY);
}
