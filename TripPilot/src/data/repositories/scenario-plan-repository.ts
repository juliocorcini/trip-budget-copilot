import { db } from '@/data/db/database';
import type { ScenarioPlan } from '@/domain/types/scenario';
import { BaseRepository } from './base-repository';

class ScenarioPlanRepository extends BaseRepository<ScenarioPlan> {
  constructor() {
    super(db.scenarioPlans);
  }

  async getActiveByPhaseAndPool(
    tripId: string,
    phaseId: string,
    budgetPoolId: string,
  ): Promise<ScenarioPlan | undefined> {
    return this.table
      .where('phaseId')
      .equals(phaseId)
      .filter(
        (p) =>
          p.deletedAt === null &&
          p.isActive &&
          p.tripId === tripId &&
          p.budgetPoolId === budgetPoolId,
      )
      .first();
  }
}

export const scenarioPlanRepository = new ScenarioPlanRepository();
