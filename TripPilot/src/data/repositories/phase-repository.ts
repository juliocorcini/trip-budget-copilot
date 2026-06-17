import { db } from '@/data/db/database';
import type { Phase } from '@/domain/types/phase';
import { BaseRepository } from './base-repository';

class PhaseRepository extends BaseRepository<Phase> {
  constructor() {
    super(db.phases);
  }

  async getByTripId(tripId: string): Promise<Phase[]> {
    const phases = await this.table
      .where('tripId')
      .equals(tripId)
      .filter((p) => p.deletedAt === null)
      .sortBy('order');
    // F17: backfill the non-indexed planned-income field for rows written before
    // it existed (ÂNCORA 14 — no migration), so callers always see a number.
    return phases.map((p) => ({ ...p, plannedIncomeCents: p.plannedIncomeCents ?? 0 }));
  }
}

export const phaseRepository = new PhaseRepository();
