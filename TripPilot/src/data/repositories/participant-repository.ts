import { db } from '@/data/db/database';
import type { Participant } from '@/domain/types/participant';
import { BaseRepository } from './base-repository';

class ParticipantRepository extends BaseRepository<Participant> {
  constructor() {
    super(db.participants);
  }

  async getByTripId(tripId: string): Promise<Participant[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((p) => p.deletedAt === null)
      .toArray();
  }

  async getOwner(tripId: string): Promise<Participant | undefined> {
    const participants = await this.table
      .where('tripId')
      .equals(tripId)
      .filter((p) => p.deletedAt === null && p.isOwner)
      .toArray();
    return participants[0];
  }
}

export const participantRepository = new ParticipantRepository();
