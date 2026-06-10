import { db } from '@/data/db/database';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import { BaseRepository } from './base-repository';

class PlannedOccurrenceRepository extends BaseRepository<PlannedOccurrence> {
  constructor() {
    super(db.plannedOccurrences);
  }

  async getByTripId(tripId: string): Promise<PlannedOccurrence[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((o) => o.deletedAt === null)
      .toArray();
  }

  async getByPhaseId(phaseId: string): Promise<PlannedOccurrence[]> {
    return this.table
      .where('phaseId')
      .equals(phaseId)
      .filter((o) => o.deletedAt === null)
      .toArray();
  }
}

export const plannedOccurrenceRepository = new PlannedOccurrenceRepository();
