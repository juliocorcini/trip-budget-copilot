import { db } from '@/data/db/database';
import type { PeerLink } from '@/domain/types/peer-link';
import { BaseRepository } from './base-repository';

class PeerLinkRepository extends BaseRepository<PeerLink> {
  constructor() {
    super(db.peerLinks);
  }

  async getByActorId(actorId: string): Promise<PeerLink | undefined> {
    const links = await this.table
      .where('actorId')
      .equals(actorId)
      .filter((link) => link.deletedAt === null)
      .toArray();
    return links[0];
  }

  async getByParticipantId(participantId: string): Promise<PeerLink | undefined> {
    const links = await this.table
      .where('participantId')
      .equals(participantId)
      .filter((link) => link.deletedAt === null)
      .toArray();
    return links[0];
  }
}

export const peerLinkRepository = new PeerLinkRepository();
