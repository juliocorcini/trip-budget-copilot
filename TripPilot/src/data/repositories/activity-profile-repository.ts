import { db } from '@/data/db/database';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import { BaseRepository } from './base-repository';

class ActivityProfileRepository extends BaseRepository<ActivityProfile> {
  constructor() {
    super(db.activityProfiles);
  }

  async getByTripId(tripId: string): Promise<ActivityProfile[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((p) => p.deletedAt === null)
      .toArray();
  }
}

export const activityProfileRepository = new ActivityProfileRepository();
