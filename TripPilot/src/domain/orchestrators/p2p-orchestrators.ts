import { v4 as uuidv4 } from 'uuid';
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
  type SharedDebtPayload,
  type PaymentPayload,
  type PaymentDirection,
  type GroupInvitePayload,
} from '@/domain/sync';
import type { MailboxPayloadKind } from '@/domain/types/mailbox';
import { createParticipant, createSettlement } from '@/domain/splitting';
import { createIncomeTransaction } from '@/domain/transactions';
import { flushOutbox, type SendToMailboxResult } from './mailbox-orchestrators';
import { resolveSelfShareName } from './sync-orchestrators';
import type { Participant } from '@/domain/types/participant';
import type { MailboxQueueItem } from '@/domain/types/mailbox';

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
  kind: Extract<MailboxPayloadKind, 'debt' | 'payment' | 'group_invite'>,
  data: SharedDebtPayload | PaymentPayload | GroupInvitePayload,
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
  const sent = await flushOutbox();
  return { delivered: sent.includes(item.id) };
}

export interface ShareDebtInput {
  peerActorId: string;
  amountCents: number;
  currency: string;
  description: string;
  occurredAt?: string | null;
}

/**
 * DEC-345 — share a debt ("you owe me X") with a connected peer. Pure announce:
 * it does NOT mutate my own totals (data-invariance) — the obligation is born on
 * the RECIPIENT's ledger when THEY accept. No-op if the peer has no key.
 */
export async function shareDebtWithPeer(input: ShareDebtInput): Promise<SendToMailboxResult> {
  const peer = await peerLinkRepository.getByActorId(input.peerActorId);
  if (!peer?.publicKey) return { delivered: false };
  const me = await getDeviceIdentity();
  const settings = await appSettingsRepository.get();
  const fromName = await resolveSelfShareName(settings);
  const payload = buildSharedDebtPayload({
    debtId: uuidv4(),
    fromActorId: me.actorId,
    fromName,
    currency: input.currency,
    amountCents: input.amountCents,
    description: input.description,
    occurredAt: input.occurredAt ?? null,
  });
  return sealAndQueue(input.peerActorId, peer.publicKey, peer.displayName, 'debt', payload);
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

  if (!peer?.publicKey) return { delivered: false };
  const payload = buildPaymentPayload({
    paymentId: uuidv4(),
    fromActorId: me.actorId,
    fromName: selfName,
    currency: input.currency,
    amountCents: input.amountCents,
    direction: input.direction,
    note: null,
  });
  return sealAndQueue(input.peerActorId, peer.publicKey, peer.displayName, 'payment', payload);
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
  if (!peer?.publicKey) return { delivered: false };
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
  kind: 'debt' | 'payment' | 'group_invite';
  /** G_last (DEC-355) — the sender's actorId, so the UI can key a per-inviter
   *  auto-accept allowlist. Empty only for legacy items drained before it existed. */
  fromActorId: string;
  fromName: string;
  debt?: SharedDebtPayload;
  payment?: PaymentPayload;
  invite?: GroupInvitePayload;
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
