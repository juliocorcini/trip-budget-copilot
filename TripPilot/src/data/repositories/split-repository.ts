import { db } from '@/data/db/database';
import type { SplitRecord } from '@/domain/types/split-record';
import { BaseRepository } from './base-repository';

class SplitRepository extends BaseRepository<SplitRecord> {
  constructor() {
    super(db.splitSessions);
  }

  /** The division that produced a committed Session ("open expense → see split"). */
  async getBySessionId(sessionId: string): Promise<SplitRecord | undefined> {
    const rows = await this.table
      .where('sessionId')
      .equals(sessionId)
      .filter((record) => record.deletedAt === null)
      .toArray();
    return rows[0];
  }

  /** Every division of a trip (committed + in-progress), newest first. */
  async listByTrip(tripId: string): Promise<SplitRecord[]> {
    const rows = await this.table
      .where('tripId')
      .equals(tripId)
      .filter((record) => record.deletedAt === null)
      .toArray();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** In-progress divisions (draft/live) the owner can resume. */
  async listResumable(): Promise<SplitRecord[]> {
    return this.table
      .where('status')
      .anyOf('draft', 'live')
      .filter((record) => record.deletedAt === null)
      .toArray();
  }
}

export const splitRepository = new SplitRepository();
