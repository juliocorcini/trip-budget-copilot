import { db } from '@/data/db/database';
import type { MirroredStatement } from '@/domain/types/mirrored-statement';
import { BaseRepository } from './base-repository';

class MirroredStatementRepository extends BaseRepository<MirroredStatement> {
  constructor() {
    super(db.mirroredStatements);
  }

  async getByPeerActorId(peerActorId: string): Promise<MirroredStatement | undefined> {
    const statements = await this.table
      .where('peerActorId')
      .equals(peerActorId)
      .filter((statement) => statement.deletedAt === null)
      .toArray();
    return statements[0];
  }
}

export const mirroredStatementRepository = new MirroredStatementRepository();
