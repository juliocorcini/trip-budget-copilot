import { db } from '@/data/db/database';
import type { Session } from '@/domain/types/session';
import { BaseRepository } from './base-repository';

class SessionRepository extends BaseRepository<Session> {
  constructor() {
    super(db.sessions);
  }

  async getByTripId(tripId: string): Promise<Session[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((s) => s.deletedAt === null)
      .toArray();
  }

  async getActive(tripId: string): Promise<Session | undefined> {
    const sessions = await this.table
      .where('tripId')
      .equals(tripId)
      .filter((s) => s.deletedAt === null && s.status === 'active')
      .toArray();
    return sessions[0];
  }
}

export const sessionRepository = new SessionRepository();
