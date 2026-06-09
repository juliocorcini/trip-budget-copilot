import { db } from '@/data/db/database';
import type { ParticipantShare } from '@/domain/types/participant-share';
import { BaseRepository } from './base-repository';

class ParticipantShareRepository extends BaseRepository<ParticipantShare> {
  constructor() {
    super(db.participantShares);
  }

  async getByTransactionId(transactionId: string): Promise<ParticipantShare[]> {
    return this.table
      .where('transactionId')
      .equals(transactionId)
      .filter((s) => s.deletedAt === null)
      .toArray();
  }

  async getByParticipantId(participantId: string): Promise<ParticipantShare[]> {
    return this.table
      .where('participantId')
      .equals(participantId)
      .filter((s) => s.deletedAt === null)
      .toArray();
  }

  async getAllForTrip(transactionIds: string[]): Promise<ParticipantShare[]> {
    if (transactionIds.length === 0) return [];
    const results = await Promise.all(
      transactionIds.map((id) => this.getByTransactionId(id)),
    );
    return results.flat();
  }
}

export const participantShareRepository = new ParticipantShareRepository();
