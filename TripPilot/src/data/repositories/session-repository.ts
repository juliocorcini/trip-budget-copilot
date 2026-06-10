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

  /** Completed sessions, newest first (DEC-079 / FIELD-09 outing history). */
  async getCompleted(tripId: string): Promise<Session[]> {
    const sessions = await this.table
      .where('tripId')
      .equals(tripId)
      .filter((s) => s.deletedAt === null && s.status === 'completed' && s.endedAt !== null)
      .toArray();
    return sessions.sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));
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
