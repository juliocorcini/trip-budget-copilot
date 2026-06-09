import { db } from '@/data/db/database';
import type { Envelope } from '@/domain/types/envelope';
import type { EnvelopeKind } from '@/domain/types/common';
import { BaseRepository } from './base-repository';

class EnvelopeRepository extends BaseRepository<Envelope> {
  constructor() {
    super(db.envelopes);
  }

  async getByPoolId(poolId: string): Promise<Envelope[]> {
    return this.table
      .where('budgetPoolId')
      .equals(poolId)
      .filter((e) => e.deletedAt === null)
      .toArray();
  }

  async getByPoolIdAndKind(poolId: string, kind: EnvelopeKind): Promise<Envelope[]> {
    return this.table
      .where('budgetPoolId')
      .equals(poolId)
      .filter((e) => e.deletedAt === null && e.kind === kind)
      .toArray();
  }
}

export const envelopeRepository = new EnvelopeRepository();
