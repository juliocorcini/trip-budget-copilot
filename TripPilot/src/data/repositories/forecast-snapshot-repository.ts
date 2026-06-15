import { db } from '@/data/db/database';
import type { ForecastSnapshot } from '@/domain/types/forecast-snapshot';
import { BaseRepository } from './base-repository';

class ForecastSnapshotRepository extends BaseRepository<ForecastSnapshot> {
  constructor() {
    super(db.forecastSnapshots);
  }

  /** One snapshot per phase per day (DEC-077 / M8.3). */
  async getByPhaseAndDate(phaseId: string, snapshotDate: string): Promise<ForecastSnapshot | undefined> {
    const snapshots = await this.table
      .where('phaseId')
      .equals(phaseId)
      .filter((s) => s.deletedAt === null && s.snapshotDate === snapshotDate)
      .toArray();
    return snapshots[0];
  }

  /** The phase's snapshot series, oldest→newest (DEC-181: forecast trend). */
  async getByPhaseId(phaseId: string): Promise<ForecastSnapshot[]> {
    const snapshots = await this.table
      .where('phaseId')
      .equals(phaseId)
      .filter((s) => s.deletedAt === null)
      .toArray();
    return snapshots.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  }
}

export const forecastSnapshotRepository = new ForecastSnapshotRepository();
