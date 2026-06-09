import { db } from '@/data/db/database';
import type { Phase } from '@/domain/types/phase';
import { BaseRepository } from './base-repository';

class PhaseRepository extends BaseRepository<Phase> {
  constructor() {
    super(db.phases);
  }

  async getByTripId(tripId: string): Promise<Phase[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((p) => p.deletedAt === null)
      .sortBy('order');
  }
}

export const phaseRepository = new PhaseRepository();
