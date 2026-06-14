import { db } from '@/data/db/database';
import type { LocalSnapshot } from '@/domain/types/local-snapshot';

/**
 * E6 (M14): local-only daily restore points. This is NOT a SyncMetadata entity
 * (no soft-delete / revision), so it does not extend BaseRepository and is never
 * exported in BackupData — the history is device-local by design.
 */
class LocalSnapshotRepository {
  private get table() {
    return db.localSnapshots;
  }

  /** All restore points, newest first. */
  async getAll(): Promise<LocalSnapshot[]> {
    return this.table.orderBy('createdAt').reverse().toArray();
  }

  async getById(id: string): Promise<LocalSnapshot | undefined> {
    return this.table.get(id);
  }

  /** Upsert — same-day id overwrites (one restore point per day). */
  async put(snapshot: LocalSnapshot): Promise<void> {
    await this.table.put(snapshot);
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length > 0) await this.table.bulkDelete(ids);
  }
}

export const localSnapshotRepository = new LocalSnapshotRepository();
