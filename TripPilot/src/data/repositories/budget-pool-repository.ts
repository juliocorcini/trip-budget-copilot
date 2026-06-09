import { db } from '@/data/db/database';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolScope } from '@/domain/types/common';
import { BaseRepository } from './base-repository';

class BudgetPoolRepository extends BaseRepository<BudgetPool> {
  constructor() {
    super(db.budgetPools);
  }

  async getByTripId(tripId: string): Promise<BudgetPool[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((p) => p.deletedAt === null)
      .toArray();
  }

  async getByScope(tripId: string, scope: BudgetPoolScope): Promise<BudgetPool[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((p) => p.deletedAt === null && p.scope === scope)
      .toArray();
  }
}

export const budgetPoolRepository = new BudgetPoolRepository();
