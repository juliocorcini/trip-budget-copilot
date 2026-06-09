import { db } from '@/data/db/database';
import type { Settlement } from '@/domain/types/settlement';
import { BaseRepository } from './base-repository';

class SettlementRepository extends BaseRepository<Settlement> {
  constructor() {
    super(db.settlements);
  }

  async getByTripId(tripId: string): Promise<Settlement[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((s) => s.deletedAt === null)
      .toArray();
  }
}

export const settlementRepository = new SettlementRepository();
