import { db } from '@/data/db/database';
import type { ShareLink } from '@/domain/types/share-link';
import { BaseRepository } from './base-repository';

class ShareLinkRepository extends BaseRepository<ShareLink> {
  constructor() {
    super(db.shareLinks);
  }

  /** The active (non-revoked, non-deleted) link for a participant, if any. */
  async getActiveByParticipantId(participantId: string): Promise<ShareLink | undefined> {
    const links = await this.table
      .where('participantId')
      .equals(participantId)
      .filter((link) => link.deletedAt === null && link.revokedAt === null)
      .toArray();
    return links[0];
  }
}

export const shareLinkRepository = new ShareLinkRepository();
