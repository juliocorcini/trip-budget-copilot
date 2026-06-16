import { db } from '@/data/db/database';
import type { Attachment } from '@/domain/types/attachment';

/**
 * DEC-206 (G1): device-local image store. Like LocalSnapshotRepository this is
 * NOT a SyncMetadata entity (no soft-delete / revision) and is never exported in
 * BackupData — images stay on the device by design. Each record is keyed to a
 * single transaction OR a single session (the other id is null and therefore not
 * indexed, so the two lookups never see each other's rows).
 */
class AttachmentRepository {
  private get table() {
    return db.attachments;
  }

  /** Images of one expense, oldest first. */
  async getByTransactionId(transactionId: string): Promise<Attachment[]> {
    const list = await this.table.where('transactionId').equals(transactionId).toArray();
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Images of one outing, oldest first. */
  async getBySessionId(sessionId: string): Promise<Attachment[]> {
    const list = await this.table.where('sessionId').equals(sessionId).toArray();
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getById(id: string): Promise<Attachment | undefined> {
    return this.table.get(id);
  }

  async add(attachment: Attachment): Promise<void> {
    await this.table.add(attachment);
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  /** Cascade helper — drop every image of an expense. */
  async deleteByTransactionId(transactionId: string): Promise<void> {
    await this.table.where('transactionId').equals(transactionId).delete();
  }
}

export const attachmentRepository = new AttachmentRepository();
