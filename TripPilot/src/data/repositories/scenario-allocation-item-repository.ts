import { db } from '@/data/db/database';
import type { ScenarioAllocationItem } from '@/domain/types/scenario';
import { BaseRepository } from './base-repository';

class ScenarioAllocationItemRepository extends BaseRepository<ScenarioAllocationItem> {
  constructor() {
    super(db.scenarioAllocationItems);
  }

  async getByPlanId(scenarioPlanId: string): Promise<ScenarioAllocationItem[]> {
    return this.table
      .where('scenarioPlanId')
      .equals(scenarioPlanId)
      .filter((item) => item.deletedAt === null)
      .toArray();
  }
}

export const scenarioAllocationItemRepository = new ScenarioAllocationItemRepository();
