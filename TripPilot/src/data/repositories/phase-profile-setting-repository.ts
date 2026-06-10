import { db } from '@/data/db/database';
import type { PhaseProfileSetting } from '@/domain/types/phase-profile-setting';
import { BaseRepository } from './base-repository';

class PhaseProfileSettingRepository extends BaseRepository<PhaseProfileSetting> {
  constructor() {
    super(db.phaseProfileSettings);
  }

  async getByPhaseId(phaseId: string): Promise<PhaseProfileSetting[]> {
    return this.table
      .where('phaseId')
      .equals(phaseId)
      .filter((s) => s.deletedAt === null)
      .toArray();
  }

  async getByPhaseAndProfile(
    phaseId: string,
    activityProfileId: string,
  ): Promise<PhaseProfileSetting | undefined> {
    const setting = await this.table
      .where('[phaseId+activityProfileId]')
      .equals([phaseId, activityProfileId])
      .first();
    return setting && setting.deletedAt === null ? setting : undefined;
  }
}

export const phaseProfileSettingRepository = new PhaseProfileSettingRepository();
