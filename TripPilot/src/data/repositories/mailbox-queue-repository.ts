import { db } from '@/data/db/database';
import { v4 as uuidv4 } from 'uuid';
import type { MailboxEnvelope, MailboxQueueItem, MailboxPayloadKind } from '@/domain/types/mailbox';

/**
 * FIELD item 8: local-only queue for the async mailbox. Like LocalSnapshot it is
 * NOT a SyncMetadata entity and is never part of BackupData — it is device-local
 * scratch space (outgoing blobs awaiting POST, incoming backups awaiting the
 * traveler's confirm).
 */
class MailboxQueueRepository {
  private get table() {
    return db.mailboxQueue;
  }

  async enqueueOut(input: {
    recipientActorId: string;
    recipientName: string;
    kind: MailboxPayloadKind;
    sealedBlob: string;
  }): Promise<MailboxQueueItem> {
    const item: MailboxQueueItem = {
      id: uuidv4(),
      direction: 'out',
      status: 'pending',
      kind: input.kind,
      createdAt: new Date().toISOString(),
      attempts: 0,
      recipientActorId: input.recipientActorId,
      recipientName: input.recipientName,
      sealedBlob: input.sealedBlob,
      fromActorId: null,
      fromName: null,
      envelope: null,
    };
    await this.table.put(item);
    return item;
  }

  async enqueueIn(input: {
    kind: MailboxPayloadKind;
    fromActorId: string;
    fromName: string;
    envelope: MailboxEnvelope;
  }): Promise<MailboxQueueItem> {
    const item: MailboxQueueItem = {
      id: uuidv4(),
      direction: 'in',
      status: 'pending',
      kind: input.kind,
      createdAt: new Date().toISOString(),
      attempts: 0,
      recipientActorId: null,
      recipientName: null,
      sealedBlob: null,
      fromActorId: input.fromActorId,
      fromName: input.fromName,
      envelope: input.envelope,
    };
    await this.table.put(item);
    return item;
  }

  async pendingOut(): Promise<MailboxQueueItem[]> {
    return this.table
      .where('direction')
      .equals('out')
      .filter((item) => item.status === 'pending')
      .sortBy('createdAt');
  }

  /** Incoming backups awaiting the traveler's confirm, newest first. */
  async pendingInbox(): Promise<MailboxQueueItem[]> {
    const items = await this.table.where('direction').equals('in').toArray();
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async bumpAttempt(id: string): Promise<void> {
    const item = await this.table.get(id);
    if (!item) return;
    await this.table.put({ ...item, attempts: item.attempts + 1, status: 'failed' });
  }

  async remove(id: string): Promise<void> {
    await this.table.delete(id);
  }
}

export const mailboxQueueRepository = new MailboxQueueRepository();
