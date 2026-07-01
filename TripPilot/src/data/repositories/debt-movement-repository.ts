import { db } from '@/data/db/database';
import type { DebtMovement } from '@/domain/types/debt-movement';
import { BaseRepository } from './base-repository';

/**
 * DEC-414 (G6): the DebtMovement audit log — device-local history of debts moved
 * between people, driving the "moved from {name}" trail's history view and one-tap
 * undo. Never backed up (the reassigned shares carry the authoritative truth).
 */
class DebtMovementRepository extends BaseRepository<DebtMovement> {
  constructor() {
    super(db.debtMovements);
  }

  async getByTripId(tripId: string): Promise<DebtMovement[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((m) => m.deletedAt === null)
      .toArray();
  }
}

export const debtMovementRepository = new DebtMovementRepository();
