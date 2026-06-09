import { db } from '@/data/db/database';
import {
  createBackup,
  mergeBackupData,
  BACKUP_TABLE_KEYS,
} from '@/domain/backup';
import type { BackupData, BackupTableKey } from '@/domain/backup';
import type { AppSettings } from '@/domain/types/app-settings';
import type { SyncMetadata } from '@/domain/types/common';
import type { EntityTable } from 'dexie';

/* eslint-disable @typescript-eslint/no-explicit-any */

function tableFor(key: BackupTableKey): EntityTable<SyncMetadata, 'id'> {
  return db[key] as unknown as EntityTable<SyncMetadata, 'id'>;
}

/**
 * GAP-003: full 21-table export, including soft-deleted records so merge
 * propagates deletions across devices.
 */
export async function buildFullBackup(settings: AppSettings): Promise<BackupData> {
  const tables = await Promise.all(BACKUP_TABLE_KEYS.map((key) => tableFor(key).toArray()));
  const data = Object.fromEntries(
    BACKUP_TABLE_KEYS.map((key, i) => [key, tables[i]]),
  ) as unknown as Pick<BackupData, BackupTableKey>;

  return createBackup({
    ...data,
    deviceId: settings.deviceName,
    appSettings: settings,
  });
}

export type ImportMode = 'merge' | 'replace';

/**
 * GAP-004: merge resolves each record by revision/updatedAt (mergeBackupData) —
 * newer incoming wins, older is kept, nothing is silently dropped.
 * All writes happen in a single Dexie transaction (zero partial imports).
 */
export async function importBackup(incoming: BackupData, mode: ImportMode): Promise<void> {
  const tables = BACKUP_TABLE_KEYS.map(tableFor);

  await db.transaction('rw', [...tables, db.appSettings] as any, async () => {
    for (const key of BACKUP_TABLE_KEYS) {
      const table = tableFor(key);
      const incomingItems = (incoming[key] ?? []) as SyncMetadata[];

      if (mode === 'replace') {
        await table.clear();
        if (incomingItems.length > 0) await table.bulkAdd(incomingItems as any);
        continue;
      }

      const localItems = await table.toArray();
      const merged = mergeBackupData(localItems, incomingItems);
      await table.clear();
      if (merged.length > 0) await table.bulkAdd(merged as any);
    }

    if (incoming.appSettings.activeTrip) {
      const settings = await db.appSettings.toCollection().first();
      if (settings) {
        await db.appSettings.put({
          ...settings,
          activeTrip: incoming.appSettings.activeTrip,
          onboardingCompleted: true,
        });
      }
    }
  });
}
