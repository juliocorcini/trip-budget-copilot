import {
  appSettingsRepository,
  mailboxQueueRepository,
} from '@/data/repositories';
import { logger } from '@/utils/logger';
import {
  getDeviceIdentity,
  getDevicePublicKeyB64,
  sealForPeer,
  openForMe,
} from '@/data/sync/identity-crypto';
import { postToMailbox, drainMailbox } from '@/data/sync/mailbox-client';
import { pingPeerMailbox } from '@/data/sync/peer-ping';
import {
  buildMailboxEnvelope,
  packEnvelope,
  unpackEnvelope,
} from '@/domain/sync/mailbox-envelope';
import { parseStatementPayload } from '@/domain/sync/statement-payload';
import { parseMigrationPayload } from '@/domain/sync/migration-payload';
import { buildConnectPayload, parseConnectPayload } from '@/domain/sync/connect-payload';
import { parseSharedDebtPayload } from '@/domain/sync/debt-payload';
import { parseDebtMovePayload } from '@/domain/sync/debt-move-payload';
import { parsePaymentPayload } from '@/domain/sync/payment-payload';
import { parseGroupInvitePayload } from '@/domain/sync/group-invite-payload';
import { applyInboundDebtMove, revertInboundDebtMove } from './debt-move-orchestrators';
import {
  storeMirroredStatement,
  upsertPeerLinkFromConnect,
  pairParticipantFromIdentity,
  linkParticipantToIdentity,
  resolveSelfShareName,
  type PairResult,
} from './sync-orchestrators';
import { importBackup, type ImportMode } from './backup-orchestrators';
import { classifySendFailure, type DeliveryReason } from '@/domain/settle-flows/delivery-status';
import type { IdentityQrPayload } from '@/domain/sync/identity';
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
  /**
   * DEC-375 (Â-HONEST) — WHY it did/didn't reach the worker, so the UI tells the
   * truth (offline vs server error vs no connection) instead of always "offline".
   */
  reason: DeliveryReason;
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
  const fromName = await resolveSelfShareName(settings);
  const envelope = buildMailboxEnvelope({
    kind,
    fromActorId: me.actorId,
    fromName,
    data,
  });
  const sealed = await sealForPeer(peer.publicKey, packEnvelope(envelope));
  const item = await mailboxQueueRepository.enqueueOut({
    recipientActorId: peer.actorId,
    recipientName: peer.displayName,
    kind,
    sealedBlob: sealed,
  });
  return resultForItem(item.id, await flushOutbox());
}

/**
 * DEC-344 (G6) — send side of the two-way handshake. After I pair with a peer (I
 * scanned their identity QR / opened their link, so I hold their public key), seal
 * a `connect` envelope carrying MY identity back to them, so their device upserts
 * the reverse `peerLink` on its next drain — both appear on each other's phones,
 * with no second scan. No-op if the peer has no key (paired pre-mailbox → they
 * re-share to enable async). Mirrors `sendPayloadToPeerMailbox`'s send semantics.
 */
export async function sendConnectHandshake(peer: {
  actorId: string;
  publicKey: string | null;
  name?: string;
}): Promise<SendToMailboxResult> {
  if (!peer.publicKey) return { delivered: false, reason: 'no_peer_key' };
  const me = await getDeviceIdentity();
  const settings = await appSettingsRepository.get();
  const myPublicKey = await getDevicePublicKeyB64();
  // DEC-350 (F13/F14): the reverse handshake must announce my REAL name (the
  // onboarding owner name), not the auto device label — otherwise the peer adds
  // me back as "Android · Chrome". This is the core of the bilateral-name fix.
  const selfName = await resolveSelfShareName(settings);
  const payload = buildConnectPayload({
    actorId: me.actorId,
    name: selfName,
    pk: myPublicKey,
  });
  const envelope = buildMailboxEnvelope({
    kind: 'connect',
    fromActorId: me.actorId,
    fromName: selfName,
    data: payload,
  });
  const sealed = await sealForPeer(peer.publicKey, packEnvelope(envelope));
  const item = await mailboxQueueRepository.enqueueOut({
    recipientActorId: peer.actorId,
    recipientName: peer.name ?? '',
    kind: 'connect',
    sealedBlob: sealed,
  });
  return resultForItem(item.id, await flushOutbox());
}

/**
 * DEC-344 (G6) — pair + auto-connect in one step. Pairs the scanned identity into
 * the trip (the scanner's forward link) AND sends the reverse `connect` handshake
 * so the peer auto-adds me too. Best-effort on the handshake: a pairing must never
 * fail because the peer is momentarily unreachable (the next drain/re-pair retries).
 */
export async function connectPeerFromIdentity(
  identity: IdentityQrPayload,
  tripId: string,
): Promise<PairResult> {
  const result = await pairParticipantFromIdentity(identity, tripId);
  try {
    await sendConnectHandshake({ actorId: identity.actorId, publicKey: identity.pk ?? null, name: identity.name });
  } catch (err) {
    // Handshake is best-effort — the forward pairing already succeeded locally.
    logger.warn('connect_handshake_failed', { module: 'mailbox-orchestrators' }, err);
  }
  return result;
}

/** DEC-344 (G6) — retroactive link of an existing participant + reverse handshake. */
export async function linkConnectFromIdentity(
  participantId: string,
  identity: IdentityQrPayload,
  tripId: string,
): Promise<PairResult | null> {
  const result = await linkParticipantToIdentity(participantId, identity, tripId);
  if (result) {
    try {
      await sendConnectHandshake({ actorId: identity.actorId, publicKey: identity.pk ?? null, name: identity.name });
    } catch (err) {
      // Best-effort handshake; the local link already succeeded.
      logger.warn('link_handshake_failed', { module: 'mailbox-orchestrators' }, err);
    }
  }
  return result;
}

export interface FlushResult {
  /** Queue-item ids that reached the worker this pass. */
  sent: string[];
  /**
   * DEC-375 — per-item failure reason for items that did NOT reach the worker
   * this pass (so the caller can tell offline from a server error honestly).
   */
  failures: Record<string, Exclude<DeliveryReason, 'ok'>>;
}

/** Posts every pending outgoing blob. Reports what sent + why the rest didn't. */
export async function flushOutbox(): Promise<FlushResult> {
  const pending = await mailboxQueueRepository.pendingOut();
  const sent: string[] = [];
  const failures: FlushResult['failures'] = {};
  for (const item of pending) {
    if (!item.recipientActorId || !item.sealedBlob) {
      await mailboxQueueRepository.remove(item.id);
      continue;
    }
    try {
      await postToMailbox(item.recipientActorId, item.sealedBlob);
      await mailboxQueueRepository.remove(item.id);
      sent.push(item.id);
      // DEC-352 (F17, G6) — the blob is in the peer's mailbox now: poke their room
      // so an open app drains in real-time instead of waiting for its next open.
      pingPeerMailbox(item.recipientActorId);
    } catch (error) {
      await mailboxQueueRepository.bumpAttempt(item.id);
      // DEC-375 — keep WHY this item stayed queued (offline vs server error) so the
      // sender sees honest copy instead of a blanket "no internet".
      failures[item.id] = classifySendFailure(error);
    }
  }
  return { sent, failures };
}

/** Map a flush pass onto a single enqueued item's honest send result (DEC-375). */
export function resultForItem(itemId: string, flush: FlushResult): SendToMailboxResult {
  if (flush.sent.includes(itemId)) return { delivered: true, reason: 'ok' };
  return { delivered: false, reason: flush.failures[itemId] ?? 'queued_offline' };
}

export interface DrainResult {
  statements: number;
  backups: number;
  /** DEC-344 (G6) — reverse `connect` handshakes folded into peerLinks this drain. */
  connects: number;
  /** DEC-345 (G7) — inbound shared debts queued PENDING (accept-first). */
  debts: number;
  /** DEC-346 (G7) — inbound P2P payments queued PENDING (confirm-first). */
  payments: number;
  /** DEC-355 (G8) — inbound group invites queued PENDING (accept-first). */
  invites: number;
  /** DEC-451 (D07) — inbound debt moves handled this drain (applied/reverted/informative). */
  debtMoves: number;
}

const EMPTY_DRAIN: DrainResult = {
  statements: 0,
  backups: 0,
  connects: 0,
  debts: 0,
  payments: 0,
  invites: 0,
  debtMoves: 0,
};

/**
 * Drains this device's mailbox (when enabled) and routes each opened envelope.
 * Failures to open (tamper / not addressed to us) are silently skipped.
 */
export async function drainMailboxIntoApp(): Promise<DrainResult> {
  const settings = await appSettingsRepository.get();
  if (!settings.mailboxEnabled) return { ...EMPTY_DRAIN };

  const me = await getDeviceIdentity();
  let messages;
  try {
    messages = await drainMailbox(me.actorId);
  } catch {
    // info (dev-only): the drain runs on every app-open/foreground, so being
    // offline here is routine — the next drain retries. Not worth prod noise.
    logger.info('mailbox_drain_failed', { module: 'mailbox-orchestrators' });
    return { ...EMPTY_DRAIN };
  }

  let statements = 0;
  let backups = 0;
  let connects = 0;
  let debts = 0;
  let payments = 0;
  let invites = 0;
  let debtMoves = 0;
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

    // DEC-344 (G6) — a peer announcing themselves: upsert the reverse peerLink so
    // they appear in my connections (no second scan) and I can seal back to them.
    if (envelope.kind === 'connect') {
      const connect = parseConnectPayload(envelope.data);
      if (connect) {
        await upsertPeerLinkFromConnect(connect);
        connects++;
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
      continue;
    }

    // DEC-345 (G7) — inbound shared debt: queue PENDING for one-tap accept
    // (accept-first ÂNCORA — nothing folds into the ledger until the user accepts).
    if (envelope.kind === 'debt') {
      const debt = parseSharedDebtPayload(envelope.data);
      if (debt) {
        await mailboxQueueRepository.enqueueIn({
          kind: 'debt',
          fromActorId: envelope.fromActorId,
          fromName: envelope.fromName,
          envelope,
        });
        debts++;
      }
      continue;
    }

    // DEC-346 (G7) — inbound P2P payment: queue PENDING for confirm (+ L8 fund
    // credit when I received the cash). Never auto-settles.
    if (envelope.kind === 'payment') {
      const payment = parsePaymentPayload(envelope.data);
      if (payment) {
        await mailboxQueueRepository.enqueueIn({
          kind: 'payment',
          fromActorId: envelope.fromActorId,
          fromName: envelope.fromName,
          envelope,
        });
        payments++;
      }
      continue;
    }

    // DEC-355 (G8) — inbound group invite: queue PENDING for one-tap accept
    // (accept-first ÂNCORA — the group only joins my list when I accept it).
    if (envelope.kind === 'group_invite') {
      const invite = parseGroupInvitePayload(envelope.data);
      if (invite) {
        await mailboxQueueRepository.enqueueIn({
          kind: 'group_invite',
          fromActorId: envelope.fromActorId,
          fromName: envelope.fromName,
          envelope,
        });
        invites++;
      }
      continue;
    }

    // DEC-451 (D07) — a debt move touching me. IMMEDIATE by product decision
    // (Julio's lock, unlike the accept-first `debt`): the recipient folds/reverts
    // right here in the drain; a dismissible inbox card records what happened so
    // nothing is silent (Â-MOVE-VISIBLE-BOTH-SIDES). `role: 'source'` is purely
    // informative — the items LEFT me on the owner's ledger; my own records are
    // never auto-mutated. When the fold cannot run yet (no active trip), the
    // card stays ACTIONABLE (no appliedAt) for a manual apply.
    if (envelope.kind === 'debt_move') {
      const move = parseDebtMovePayload(envelope.data);
      if (move) {
        let annotated = move;
        if (move.role === 'recipient' && move.direction === 'apply') {
          const applied = await applyInboundDebtMove(move, envelope.fromActorId, envelope.fromName);
          if (applied) annotated = { ...move, appliedAt: new Date().toISOString() };
        } else if (move.role === 'recipient' && move.direction === 'revert') {
          await revertInboundDebtMove(move, envelope.fromActorId);
          annotated = { ...move, revertedAt: new Date().toISOString() };
        }
        // A redelivered envelope must not stack duplicate cards (the fold above
        // is already ref-idempotent) — one card per move+direction.
        const pendingCards = await mailboxQueueRepository.pendingInbox();
        const duplicate = pendingCards.some((card) => {
          if (card.kind !== 'debt_move' || !card.envelope) return false;
          const queued = parseDebtMovePayload(card.envelope.data);
          return queued?.moveId === move.moveId && queued.direction === move.direction;
        });
        if (!duplicate) {
          await mailboxQueueRepository.enqueueIn({
            kind: 'debt_move',
            fromActorId: envelope.fromActorId,
            fromName: envelope.fromName,
            envelope: { ...envelope, data: annotated },
          });
        }
        debtMoves++;
      }
      continue;
    }
  }
  return { statements, backups, connects, debts, payments, invites, debtMoves };
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
