import { db } from '@/data/db/database';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import { BaseRepository } from './base-repository';

class BudgetPoolPhaseLinkRepository extends BaseRepository<BudgetPoolPhaseLink> {
  constructor() {
    super(db.budgetPoolPhaseLinks);
  }

  async getByPoolId(poolId: string): Promise<BudgetPoolPhaseLink[]> {
    return this.table
      .where('budgetPoolId')
      .equals(poolId)
      .filter((l) => l.deletedAt === null)
      .toArray();
  }

  async getByPhaseId(phaseId: string): Promise<BudgetPoolPhaseLink[]> {
    return this.table
      .where('phaseId')
      .equals(phaseId)
      .filter((l) => l.deletedAt === null)
      .toArray();
  }
}

export const budgetPoolPhaseLinkRepository = new BudgetPoolPhaseLinkRepository();
