import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import {
  appSettingsRepository,
  mailboxQueueRepository,
  participantRepository,
  participantShareRepository,
  settlementRepository,
  peerLinkRepository,
  transactionRepository,
} from '@/data/repositories';
import { getDeviceIdentity, sealForPeer } from '@/data/sync/identity-crypto';
import { buildMailboxEnvelope, packEnvelope } from '@/domain/sync/mailbox-envelope';
import {
  buildSharedDebtPayload,
  parseSharedDebtPayload,
  buildPaymentPayload,
  parsePaymentPayload,
  buildExpenseFromSharedDebt,
  externalRefForDebt,
  resolvePaymentParties,
  buildGroupInvitePayload,
  parseGroupInvitePayload,
  buildDebtMovePayload,
  parseDebtMovePayload,
  type SharedDebtPayload,
  type PaymentPayload,
  type PaymentDirection,
  type GroupInvitePayload,
  type DebtMovePayload,
} from '@/domain/sync';
import type { MailboxPayloadKind } from '@/domain/types/mailbox';
import { createParticipant, createSettlement } from '@/domain/splitting';
import { createIncomeTransaction } from '@/domain/transactions';
import { flushOutbox, resultForItem, type SendToMailboxResult } from './mailbox-orchestrators';
import { resolveSelfShareName } from './sync-orchestrators';
import {
  planManualSplitDeliveries,
  type ManualSplitDeliveryInput,
} from '@/domain/settle-flows/manual-split-delivery';
import type { Participant } from '@/domain/types/participant';
import type { MailboxQueueItem } from '@/domain/types/mailbox';
import type { ImageRef } from '@/domain/media';

/**
 * DEC-345/346 (G7) — live P2P debt & payment over the E2E mailbox.
 *
 * SEND side seals a `debt`/`payment` envelope to a connected peer; DRAIN (in
 * `mailbox-orchestrators`) stores it to the local inbox as PENDING (accept-first
 * ÂNCORA) — these orchestrators are the user's ACCEPT/CONFIRM actions that fold a
 * pending item into the ledger. Everything reuses the canonical splitting/funds
 * engines (no new money math); the Worker only ever forwards opaque ciphertext.
 */

async function sealAndQueue(
  peerActorId: string,
  peerPublicKey: string,
  peerName: string,
  kind: Extract<MailboxPayloadKind, 'debt' | 'payment' | 'group_invite' | 'debt_move'>,
  data: SharedDebtPayload | PaymentPayload | GroupInvitePayload | DebtMovePayload,
): Promise<SendToMailboxResult> {
  const me = await getDeviceIdentity();
  const settings = await appSettingsRepository.get();
  const fromName = await resolveSelfShareName(settings);
  const envelope = buildMailboxEnvelope({
    kind,
    fromActorId: me.actorId,
    fromName,
    data,
  });
  const sealed = await sealForPeer(peerPublicKey, packEnvelope(envelope));
  const item = await mailboxQueueRepository.enqueueOut({
    recipientActorId: peerActorId,
    recipientName: peerName,
    kind,
    sealedBlob: sealed,
  });
  return resultForItem(item.id, await flushOutbox());
}

export interface ShareDebtInput {
  peerActorId: string;
  amountCents: number;
  currency: string;
  description: string;
  occurredAt?: string | null;
  /**
   * DEC-377 — a STABLE debt id, supplied when the debt must be idempotent across
   * re-sends (the auto-delivered manual split derives it from the expense +
   * person). Omitted for a one-off charge, where each send is a distinct debt.
   */
  debtId?: string;
}

/**
 * DEC-345 — share a debt ("you owe me X") with a connected peer. Pure announce:
 * it does NOT mutate my own totals (data-invariance) — the obligation is born on
 * the RECIPIENT's ledger when THEY accept. No-op if the peer has no key.
 */
export async function shareDebtWithPeer(input: ShareDebtInput): Promise<SendToMailboxResult> {
  const peer = await peerLinkRepository.getByActorId(input.peerActorId);
  if (!peer?.publicKey) return { delivered: false, reason: 'no_peer_key' };
  const me = await getDeviceIdentity();
  const settings = await appSettingsRepository.get();
  const fromName = await resolveSelfShareName(settings);
  const payload = buildSharedDebtPayload({
    debtId: input.debtId ?? uuidv4(),
    fromActorId: me.actorId,
    fromName,
    currency: input.currency,
    amountCents: input.amountCents,
    description: input.description,
    occurredAt: input.occurredAt ?? null,
  });
  return sealAndQueue(input.peerActorId, peer.publicKey, peer.displayName, 'debt', payload);
}

/**
 * DEC-377 (G3, Â-CONSISTENT-SPLIT) — deliver a just-saved manual split's
 * connected slices as accept-first debts, the SAME path as "Dividir conta"
 * (`shareDebtWithPeer`). Best-effort and NEVER throws: a failed send stays
 * queued (the local pending share already recorded the split), so the #1 action
 * is never blocked (A5). Sequential because each send flushes the shared outbox
 * — running them in parallel would race that flush. Idempotent by the stable
 * `debtId` (DEC-377), so a re-save never folds a second debt on the recipient.
 */
export async function deliverManualSplitDebts(input: ManualSplitDeliveryInput): Promise<void> {
  for (const delivery of planManualSplitDeliveries(input)) {
    try {
      await shareDebtWithPeer({
        peerActorId: delivery.peerActorId,
        amountCents: delivery.amountCents,
        currency: delivery.currency,
        description: delivery.description,
        occurredAt: delivery.occurredAt,
        debtId: delivery.debtId,
      });
    } catch (err) {
      // Best-effort — the split is already a local pending share; the queued
      // outbox item retries on the next flush. Delivery never blocks the save.
      logger.warn('split_debt_delivery_failed', { module: 'p2p-orchestrators' }, err);
    }
  }
}

export interface AnnouncePaymentInput {
  peerActorId: string;
  /** The peer's participant on MY trip. */
  peerParticipantId: string;
  /** Me (owner) on my trip. */
  myParticipantId: string;
  tripId: string;
  amountCents: number;
  currency: string;
  /** 'paid' = I paid them (I'm the debtor); 'received' = they paid me (I'm the creditor). */
  direction: PaymentDirection;
  /** Required when direction = 'received' (I got the cash → L8 fund credit). */
  fundCredit?: { phaseId: string; budgetPoolId: string; walletId: string | null } | null;
  /**
   * DEC-363 (Item D) — an OPTIONAL payment proof (R2 image ref + inline thumb)
   * sealed to the peer so they see it before confirming. Display-only; never
   * touches the settlement math.
   */
  proof?: ImageRef | null;
  proofThumb?: string | null;
}

/**
 * DEC-346 (L8) — announce a P2P repayment. Settles MY side immediately (the cash
 * genuinely moved), credits a fund when *I* received it, and seals the payment to
 * the peer so THEY settle their side on confirm. Both sides close; never red.
 */
export async function announcePaymentToPeer(input: AnnouncePaymentInput): Promise<SendToMailboxResult> {
  const peer = await peerLinkRepository.getByActorId(input.peerActorId);
  const me = await getDeviceIdentity();
  const settings = await appSettingsRepository.get();
  const selfName = await resolveSelfShareName(settings);

  const debtor = input.direction === 'paid' ? input.myParticipantId : input.peerParticipantId;
  const creditor = input.direction === 'paid' ? input.peerParticipantId : input.myParticipantId;
  await settlementRepository.create(
    createSettlement(input.tripId, debtor, creditor, input.amountCents, input.currency),
  );

  // L8: when I am the one who RECEIVED the money, it is a real inflow → credit
  // the fund/wallet the user chose. (When I paid, money left me — no inflow.)
  if (input.direction === 'received' && input.fundCredit) {
    await transactionRepository.create(
      createIncomeTransaction({
        tripId: input.tripId,
        phaseId: input.fundCredit.phaseId,
        budgetPoolId: input.fundCredit.budgetPoolId,
        walletId: input.fundCredit.walletId,
        amountCents: input.amountCents,
        currency: input.currency,
        description: `${peer?.displayName ?? selfName} → ${selfName}`,
      }),
    );
  }

  if (!peer?.publicKey) return { delivered: false, reason: 'no_peer_key' };
  const payload = buildPaymentPayload({
    paymentId: uuidv4(),
    fromActorId: me.actorId,
    fromName: selfName,
    currency: input.currency,
    amountCents: input.amountCents,
    direction: input.direction,
    note: null,
    proof: input.proof ?? null,
    proofThumb: input.proofThumb ?? null,
  });
  return sealAndQueue(input.peerActorId, peer.publicKey, peer.displayName, 'payment', payload);
}

export interface SendDebtMoveInput {
  /** Stable move id = the owner's DebtMovement record id (apply/revert correlate). */
  moveId: string;
  direction: 'apply' | 'revert';
  fromPersonName: string;
  toPersonName: string;
  currency: string;
  items: Array<{
    moveItemId: string;
    amountCents: number;
    description: string;
    occurredAt?: string | null;
  }>;
  /** The destination person's actorId when they are connected (gets the fold). */
  recipientActorId?: string | null;
  /** The origin person's actorId when they are connected (informative only). */
  sourceActorId?: string | null;
}

/**
 * DEC-451 (D07) — propagate a debt move to every connected device it touches.
 * The RECIPIENT envelope folds/reverts on their drain; the SOURCE envelope is
 * informative ("items left you"). Best-effort and NEVER throws: the owner's
 * local reassignment already happened (Julio's instant lock) and a failed send
 * stays queued for the next flush. Skips peers with no key silently.
 */
export async function sendDebtMoveEnvelopes(input: SendDebtMoveInput): Promise<void> {
  const settings = await appSettingsRepository.get();
  const movedByName = await resolveSelfShareName(settings);
  const targets: Array<{ actorId: string; role: DebtMovePayload['role'] }> = [];
  if (input.recipientActorId) targets.push({ actorId: input.recipientActorId, role: 'recipient' });
  if (input.sourceActorId) targets.push({ actorId: input.sourceActorId, role: 'source' });

  for (const target of targets) {
    try {
      const peer = await peerLinkRepository.getByActorId(target.actorId);
      if (!peer?.publicKey) continue;
      const payload = buildDebtMovePayload({
        moveId: input.moveId,
        direction: input.direction,
        role: target.role,
        fromPersonName: input.fromPersonName,
        toPersonName: input.toPersonName,
        movedByName,
        currency: input.currency,
        items: input.items,
      });
      await sealAndQueue(target.actorId, peer.publicKey, peer.displayName, 'debt_move', payload);
    } catch (err) {
      // The local move stands; the peer catches up on a later send/drain.
      logger.warn('debt_move_send_failed', { module: 'p2p-orchestrators' }, err);
    }
  }
}

export interface ShareGroupInviteInput {
  peerActorId: string;
  shareId: string;
  /** The `/g/` AES read key (the link-fragment secret). */
  key: string;
  groupName: string;
}

/**
 * DEC-355 (G8) — invite a connected peer to a group split. Seals the group's `/g/`
 * read credentials (id + key, NOT the write token) to the peer's mailbox so their
 * app shows the group accept-first. No-op if the peer has no key (re-pair to
 * enable async). The owner stays the money authority — this only grants reading.
 */
export async function sendGroupInvite(input: ShareGroupInviteInput): Promise<SendToMailboxResult> {
  const peer = await peerLinkRepository.getByActorId(input.peerActorId);
  if (!peer?.publicKey) return { delivered: false, reason: 'no_peer_key' };
  const payload = buildGroupInvitePayload({
    shareId: input.shareId,
    key: input.key,
    groupName: input.groupName,
  });
  return sealAndQueue(input.peerActorId, peer.publicKey, peer.displayName, 'group_invite', payload);
}

/** A pending inbound P2P item, parsed for the UI (accept/confirm surface). */
export interface InboundP2pItem {
  itemId: string;
  kind: 'debt' | 'payment' | 'group_invite' | 'debt_move';
  /** G_last (DEC-355) — the sender's actorId, so the UI can key a per-inviter
   *  auto-accept allowlist. Empty only for legacy items drained before it existed. */
  fromActorId: string;
  fromName: string;
  debt?: SharedDebtPayload;
  payment?: PaymentPayload;
  invite?: GroupInvitePayload;
  /** DEC-451 — a debt move that touched me (applied/informative/actionable card). */
  debtMove?: DebtMovePayload;
}

/** Pending inbound debts + payments + group invites awaiting the user's accept/confirm. */
export async function getInboundP2pItems(): Promise<InboundP2pItem[]> {
  const items = await mailboxQueueRepository.pendingInbox();
  const out: InboundP2pItem[] = [];
  for (const item of items) {
    if (!item.envelope) continue;
    const fromActorId = item.fromActorId ?? item.envelope.fromActorId ?? '';
    if (item.kind === 'debt') {
      const debt = parseSharedDebtPayload(item.envelope.data);
      if (debt) out.push({ itemId: item.id, kind: 'debt', fromActorId, fromName: item.fromName ?? debt.fromName, debt });
    } else if (item.kind === 'payment') {
      const payment = parsePaymentPayload(item.envelope.data);
      if (payment) out.push({ itemId: item.id, kind: 'payment', fromActorId, fromName: item.fromName ?? payment.fromName, payment });
    } else if (item.kind === 'group_invite') {
      const invite = parseGroupInvitePayload(item.envelope.data);
      if (invite) out.push({ itemId: item.id, kind: 'group_invite', fromActorId, fromName: item.fromName ?? '', invite });
    } else if (item.kind === 'debt_move') {
      const debtMove = parseDebtMovePayload(item.envelope.data);
      if (debtMove) out.push({ itemId: item.id, kind: 'debt_move', fromActorId, fromName: item.fromName ?? debtMove.movedByName, debtMove });
    }
  }
  return out;
}

async function resolveOrCreatePeerParticipant(
  tripId: string,
  actorId: string,
  name: string,
): Promise<Participant> {
  const participants = await participantRepository.getByTripId(tripId);
  const existing = participants.find((p) => p.linkedActorId === actorId && p.deletedAt === null);
  if (existing) return existing;
  const created: Participant = { ...createParticipant(tripId, name, null), linkedActorId: actorId };
  await participantRepository.create(created);
  const link = await peerLinkRepository.getByActorId(actorId);
  if (link && link.participantId !== created.id) {
    await peerLinkRepository.update({ ...link, participantId: created.id });
  }
  return created;
}

/**
 * DEC-376 (G2, Â-BILATERAL) — materialize a connected friend into THIS trip
 * on-demand. The unified people list surfaces a `peerLink(participantId:null)` as
 * a selectable row (`needsParticipant`); the first time the user charges/splits
 * them, this folds them into a real trip participant — dedupe by `actorId` (reuse
 * the mapped participant if it already exists) and stamp `peerLink.participantId`
 * so the row stops reading as "new". Returns null when the link is gone / has no
 * key (cannot deliver), so the caller stays a no-op. Moves zero cents (the ledger
 * keys off `participantId`); it only creates the addressable person.
 */
export async function materializeConnectedParticipant(
  tripId: string,
  actorId: string,
): Promise<Participant | null> {
  const link = await peerLinkRepository.getByActorId(actorId);
  if (!link || link.deletedAt !== null || !link.publicKey) return null;
  return resolveOrCreatePeerParticipant(tripId, actorId, link.displayName);
}

export interface AcceptDebtTarget {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
}

/**
 * DEC-345 — ACCEPT a pending inbound debt: fold it as a shared expense on my
 * ledger (payer = the sender; my confirmed share = the amount). Idempotent via
 * the debt's `externalRef`. Returns false if the item/payload is gone or the
 * trip has no owner participant (never throws).
 */
export async function acceptInboundDebt(itemId: string, target: AcceptDebtTarget): Promise<boolean> {
  const item = await findInboxItem(itemId);
  const debt = item?.envelope ? parseSharedDebtPayload(item.envelope.data) : null;
  if (!debt) {
    if (item) await mailboxQueueRepository.remove(itemId);
    return false;
  }

  const participants = await participantRepository.getByTripId(target.tripId);
  const owner = participants.find((p) => p.isOwner && p.deletedAt === null);
  if (!owner) return false;

  // Idempotency: if this debt was already folded, just drop the inbox item.
  const ref = externalRefForDebt(debt);
  const existing = await transactionRepository.getByTripId(target.tripId);
  if (existing.some((t) => t.externalRef === ref)) {
    await mailboxQueueRepository.remove(itemId);
    return true;
  }

  const creditor = await resolveOrCreatePeerParticipant(target.tripId, debt.fromActorId, debt.fromName);
  const { transaction, shares } = buildExpenseFromSharedDebt({
    debt,
    tripId: target.tripId,
    phaseId: target.phaseId,
    budgetPoolId: target.budgetPoolId,
    creditorParticipantId: creditor.id,
    myParticipantId: owner.id,
  });
  await transactionRepository.create(transaction);
  await participantShareRepository.bulkCreate(shares);
  await mailboxQueueRepository.remove(itemId);
  return true;
}

export interface ConfirmPaymentTarget {
  tripId: string;
  /** Me (owner) on my trip. */
  myParticipantId: string;
  /** Required when I RECEIVED the money (direction 'paid') — the L8 fund credit. */
  fundCredit?: { phaseId: string; budgetPoolId: string; walletId: string | null } | null;
}

/**
 * DEC-346 (L8) — CONFIRM a pending inbound payment: close the obligation on my
 * side (a Settlement, never red) and, when I received the cash, credit the chosen
 * fund/wallet. Idempotent via a settlement `externalRef`. Returns false on a gone
 * item / unresolvable peer.
 */
export async function confirmInboundPayment(itemId: string, target: ConfirmPaymentTarget): Promise<boolean> {
  const item = await findInboxItem(itemId);
  const payment = item?.envelope ? parsePaymentPayload(item.envelope.data) : null;
  if (!payment) {
    if (item) await mailboxQueueRepository.remove(itemId);
    return false;
  }

  // Idempotency: a re-delivered/re-confirmed payment must not double-settle.
  const ref = `payment:${payment.fromActorId}:${payment.paymentId}`;
  const priorSettlements = await settlementRepository.getByTripId(target.tripId);
  if (priorSettlements.some((s) => s.externalRef === ref)) {
    await mailboxQueueRepository.remove(itemId);
    return true;
  }

  const peer = await resolveOrCreatePeerParticipant(target.tripId, payment.fromActorId, payment.fromName);
  const parties = resolvePaymentParties({
    direction: payment.direction,
    myParticipantId: target.myParticipantId,
    peerParticipantId: peer.id,
  });

  const settlement = createSettlement(
    target.tripId,
    parties.debtorParticipantId,
    parties.creditorParticipantId,
    payment.amountCents,
    payment.currency,
  );
  settlement.externalRef = ref;
  await settlementRepository.create(settlement);

  if (parties.iReceived && target.fundCredit) {
    const selfName = await resolveSelfShareName();
    await transactionRepository.create(
      createIncomeTransaction({
        tripId: target.tripId,
        phaseId: target.fundCredit.phaseId,
        budgetPoolId: target.fundCredit.budgetPoolId,
        walletId: target.fundCredit.walletId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        description: `${payment.fromName} → ${selfName}`,
      }),
    );
  }

  await mailboxQueueRepository.remove(itemId);
  return true;
}

/**
 * DEC-355 (G8) — ACCEPT a pending group invite: drop the inbox item and return
 * its `/g/` read credentials so the caller can persist the joined group + open the
 * live board. Returns null if the item/payload is gone (the item is still cleared).
 * Storing the credentials is the caller's job (a client-only localStorage map —
 * the orchestrator stays free of that boundary, like the owner-live creds).
 */
export async function acceptGroupInvite(itemId: string): Promise<GroupInvitePayload | null> {
  const item = await findInboxItem(itemId);
  const invite = item?.envelope ? parseGroupInvitePayload(item.envelope.data) : null;
  if (item) await mailboxQueueRepository.remove(itemId);
  return invite;
}

/** REJECT/dismiss a pending inbound item (hide-never-corrupt: just drop it). */
export async function dismissInboundP2p(itemId: string): Promise<void> {
  await mailboxQueueRepository.remove(itemId);
}

async function findInboxItem(itemId: string): Promise<MailboxQueueItem | null> {
  const items = await mailboxQueueRepository.pendingInbox();
  return items.find((i) => i.id === itemId) ?? null;
}
