import {
  appSettingsRepository,
  mailboxQueueRepository,
} from '@/data/repositories';
import { getDeviceIdentity, sealForPeer, openForMe } from '@/data/sync/identity-crypto';
import { postToMailbox, drainMailbox } from '@/data/sync/mailbox-client';
import {
  buildMailboxEnvelope,
  packEnvelope,
  unpackEnvelope,
} from '@/domain/sync/mailbox-envelope';
import { parseStatementPayload } from '@/domain/sync/statement-payload';
import { parseMigrationPayload } from '@/domain/sync/migration-payload';
import { storeMirroredStatement } from './sync-orchestrators';
import { importBackup, type ImportMode } from './backup-orchestrators';
import type { PeerLink } from '@/domain/types/peer-link';
import type { MailboxPayloadKind, MailboxQueueItem } from '@/domain/types/mailbox';

/**
 * FIELD item 8: orchestrators for the async encrypted mailbox. Sealing/posting
 * is queued (survives the sender being offline); draining decrypts on open and
 * routes each envelope — statements land in the mirrored-statement surface
 * (already a confirm step), backups wait in the local inbox for the traveler.
 */

export interface SendToMailboxResult {
  /** true when the blob reached the worker now; false when it was queued. */
  delivered: boolean;
}

/**
 * Seals `data` for a peer and posts it (queuing on failure). The peer must have
 * a public key — captured when their identity QR was scanned.
 */
export async function sendPayloadToPeerMailbox(
  peer: PeerLink,
  kind: MailboxPayloadKind,
  data: unknown,
): Promise<SendToMailboxResult> {
  if (!peer.publicKey) throw new Error('peer_no_public_key');
  const me = await getDeviceIdentity();
  const settings = await appSettingsRepository.get();
  const envelope = buildMailboxEnvelope({
    kind,
    fromActorId: me.actorId,
    fromName: settings.deviceName,
    data,
  });
  const sealed = await sealForPeer(peer.publicKey, packEnvelope(envelope));
  const item = await mailboxQueueRepository.enqueueOut({
    recipientActorId: peer.actorId,
    recipientName: peer.displayName,
    kind,
    sealedBlob: sealed,
  });
  const sentIds = await flushOutbox();
  return { delivered: sentIds.includes(item.id) };
}

/** Posts every pending outgoing blob. Returns the ids that reached the worker. */
export async function flushOutbox(): Promise<string[]> {
  const pending = await mailboxQueueRepository.pendingOut();
  const sent: string[] = [];
  for (const item of pending) {
    if (!item.recipientActorId || !item.sealedBlob) {
      await mailboxQueueRepository.remove(item.id);
      continue;
    }
    try {
      await postToMailbox(item.recipientActorId, item.sealedBlob);
      await mailboxQueueRepository.remove(item.id);
      sent.push(item.id);
    } catch {
      await mailboxQueueRepository.bumpAttempt(item.id);
    }
  }
  return sent;
}

export interface DrainResult {
  statements: number;
  backups: number;
}

/**
 * Drains this device's mailbox (when enabled) and routes each opened envelope.
 * Failures to open (tamper / not addressed to us) are silently skipped.
 */
export async function drainMailboxIntoApp(): Promise<DrainResult> {
  const settings = await appSettingsRepository.get();
  if (!settings.mailboxEnabled) return { statements: 0, backups: 0 };

  const me = await getDeviceIdentity();
  let messages;
  try {
    messages = await drainMailbox(me.actorId);
  } catch {
    return { statements: 0, backups: 0 };
  }

  let statements = 0;
  let backups = 0;
  for (const message of messages) {
    const packed = await openForMe(message.blob);
    if (!packed) continue;
    const envelope = unpackEnvelope(packed);
    if (!envelope) continue;

    if (envelope.kind === 'statement') {
      const payload = parseStatementPayload(envelope.data);
      if (payload) {
        await storeMirroredStatement(payload);
        statements++;
      }
      continue;
    }

    if (envelope.kind === 'backup') {
      const migration = parseMigrationPayload(envelope.data);
      if (migration) {
        await mailboxQueueRepository.enqueueIn({
          kind: 'backup',
          fromActorId: envelope.fromActorId,
          fromName: envelope.fromName,
          envelope,
        });
        backups++;
      }
    }
  }
  return { statements, backups };
}

/** The backups drained from the mailbox awaiting the traveler's confirm. */
export async function getInboxBackups(): Promise<MailboxQueueItem[]> {
  const items = await mailboxQueueRepository.pendingInbox();
  return items.filter((item) => item.kind === 'backup');
}

/**
 * Applies a queued inbox backup (always an explicit traveler action — choice
 * "sempre mostrar e confirmar antes"). Returns false when the payload is no
 * longer valid.
 */
export async function applyInboxBackup(itemId: string, mode: ImportMode): Promise<boolean> {
  const items = await mailboxQueueRepository.pendingInbox();
  const item = items.find((i) => i.id === itemId);
  if (!item?.envelope) return false;
  const migration = parseMigrationPayload(item.envelope.data);
  if (!migration) {
    await mailboxQueueRepository.remove(itemId);
    return false;
  }
  await importBackup(migration.data, mode);
  await mailboxQueueRepository.remove(itemId);
  return true;
}

export async function dismissInboxItem(itemId: string): Promise<void> {
  await mailboxQueueRepository.remove(itemId);
}
