import { db } from '@/data/db/database';
import type { Trip } from '@/domain/types/trip';
import type { TripStatus } from '@/domain/types/common';
import { BaseRepository } from './base-repository';

class TripRepository extends BaseRepository<Trip> {
  constructor() {
    super(db.trips);
  }

  async getByStatus(status: TripStatus): Promise<Trip[]> {
    return this.table
      .where('status')
      .equals(status)
      .filter((t) => t.deletedAt === null)
      .toArray();
  }

  async getActive(): Promise<Trip | undefined> {
    const trips = await this.getByStatus('active');
    return trips[0];
  }
}

export const tripRepository = new TripRepository();
