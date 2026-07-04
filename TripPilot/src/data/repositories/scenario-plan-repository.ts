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

  /**
   * DEC-462 (field fix 2026-07-04): the phase's active plan, PREFERRING the one
   * keyed to the phase's own fund but falling back to any active plan of the
   * phase. A plan is conceptually per-phase; the pool key is derivative — after
   * a pool relink (or the pre-fix readers writing under the first pool) the key
   * can drift, and the strict (phase, pool) lookup silently reported "no plan"
   * (the zeroed-planner bug). Readers use this; the Planner migrates the key on
   * its next persist.
   */
  async getActiveForPhase(
    tripId: string,
    phaseId: string,
    preferredPoolId: string | null,
  ): Promise<ScenarioPlan | undefined> {
    const candidates = await this.table
      .where('phaseId')
      .equals(phaseId)
      .filter((p) => p.deletedAt === null && p.isActive && p.tripId === tripId)
      .toArray();
    if (candidates.length === 0) return undefined;
    return (
      candidates.find((p) => preferredPoolId !== null && p.budgetPoolId === preferredPoolId) ??
      candidates[0]
    );
  }
}

export const scenarioPlanRepository = new ScenarioPlanRepository();
