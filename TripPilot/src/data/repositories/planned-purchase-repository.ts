import { db } from '@/data/db/database';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import { BaseRepository } from './base-repository';

class PlannedPurchaseRepository extends BaseRepository<PlannedPurchase> {
  constructor() {
    super(db.plannedPurchases);
  }

  async getByTripId(tripId: string): Promise<PlannedPurchase[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((p) => p.deletedAt === null)
      .toArray();
  }
}

export const plannedPurchaseRepository = new PlannedPurchaseRepository();
