import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  acceptInboundDebt,
  confirmInboundPayment,
  acceptGroupInvite,
  dismissInboundP2p,
  getInboundP2pItems,
} from '@/domain/orchestrators';
import {
  participantRepository,
  transactionRepository,
  participantShareRepository,
  settlementRepository,
  mailboxQueueRepository,
} from '@/data/repositories';
import { buildSharedDebtPayload, buildPaymentPayload, buildGroupInvitePayload } from '@/domain/sync';
import { buildMailboxEnvelope } from '@/domain/sync/mailbox-envelope';
import { createParticipant, calculateDebts } from '@/domain/splitting';
import type { Participant } from '@/domain/types/participant';

// DEC-345/346 (G7) — the money-correctness core of live P2P, tested against the
// real (fake-indexeddb) db with NO network: enqueue an inbound item exactly as a
// drain would, then exercise the user's ACCEPT/CONFIRM action and assert the
// ledger in cents. Accept-first + idempotency + receiver data-invariance.

const TRIP = 'trip-g7';
const SENDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEBT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PAYMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PHASE = 'phase-1';
const POOL = 'pool-1';

async function seedOwner(): Promise<Participant> {
  const owner: Participant = { ...createParticipant(TRIP, 'Me', null), isOwner: true };
  await participantRepository.create(owner);
  return owner;
}

async function enqueueDebt(amountCents = 5000): Promise<string> {
  const debt = buildSharedDebtPayload({
    debtId: DEBT_ID,
    fromActorId: SENDER,
    fromName: 'Bruno',
    currency: 'BRL',
    amountCents,
    description: 'Dinner',
    occurredAt: null,
  });
  const envelope = buildMailboxEnvelope({ kind: 'debt', fromActorId: SENDER, fromName: 'Bruno', data: debt });
  const item = await mailboxQueueRepository.enqueueIn({ kind: 'debt', fromActorId: SENDER, fromName: 'Bruno', envelope });
  return item.id;
}

async function enqueuePayment(direction: 'paid' | 'received', amountCents: number): Promise<string> {
  const payment = buildPaymentPayload({
    paymentId: PAYMENT_ID,
    fromActorId: SENDER,
    fromName: 'Bruno',
    currency: 'BRL',
    amountCents,
    direction,
    note: null,
  });
  const envelope = buildMailboxEnvelope({ kind: 'payment', fromActorId: SENDER, fromName: 'Bruno', data: payment });
  const item = await mailboxQueueRepository.enqueueIn({ kind: 'payment', fromActorId: SENDER, fromName: 'Bruno', envelope });
  return item.id;
}

async function enqueueInvite(shareId = 'g_share1', key = 'read-key', groupName = 'Lisbon'): Promise<string> {
  const invite = buildGroupInvitePayload({ shareId, key, groupName });
  const envelope = buildMailboxEnvelope({
    kind: 'group_invite',
    fromActorId: SENDER,
    fromName: 'Bruno',
    data: invite,
  });
  const item = await mailboxQueueRepository.enqueueIn({
    kind: 'group_invite',
    fromActorId: SENDER,
    fromName: 'Bruno',
    envelope,
  });
  return item.id;
}

async function readLedger() {
  const [transactions, settlements, participants] = await Promise.all([
    transactionRepository.getByTripId(TRIP),
    settlementRepository.getByTripId(TRIP),
    participantRepository.getByTripId(TRIP),
  ]);
  const shares = await participantShareRepository.getAllForTrip(transactions.map((t) => t.id));
  return { transactions, settlements, participants, shares };
}

describe('P2P inbound orchestrators (DEC-345/346)', () => {
  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.participantShares.clear(),
      db.settlements.clear(),
      db.participants.clear(),
      db.peerLinks.clear(),
      db.mailboxQueue.clear(),
    ]);
  });

  it('accept-first: a queued debt changes NO totals until the user accepts (receiver data-invariance)', async () => {
    await seedOwner();
    await enqueueDebt(5000);

    // Pending in the inbox, but the ledger is untouched.
    const before = await readLedger();
    expect(before.transactions).toHaveLength(0);
    const pending = await getInboundP2pItems();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.kind).toBe('debt');
    expect(pending[0]!.debt?.amountCents).toBe(5000);
  });

  it('acceptInboundDebt folds a shared expense — I owe the sender the exact cents', async () => {
    const owner = await seedOwner();
    const itemId = await enqueueDebt(5000);

    const ok = await acceptInboundDebt(itemId, { tripId: TRIP, phaseId: PHASE, budgetPoolId: POOL });
    expect(ok).toBe(true);

    const { transactions, shares, settlements, participants } = await readLedger();
    expect(transactions).toHaveLength(1);
    const tx = transactions[0]!;
    expect(tx.type).toBe('expense');
    expect(tx.isShared).toBe(true);
    expect(tx.amountCents).toBe(5000);
    expect(tx.budgetPoolId).toBe(POOL);
    expect(tx.externalRef).toBe(`debt:${SENDER}:${DEBT_ID}`);

    // The sender is materialized as a trip participant = the payer (creditor).
    const sender = participants.find((p) => p.linkedActorId === SENDER);
    expect(sender).toBeTruthy();
    expect(tx.paidByParticipantId).toBe(sender!.id);

    // A single confirmed share = my whole owed amount.
    expect(shares).toHaveLength(1);
    expect(shares[0]!.participantId).toBe(owner.id);
    expect(shares[0]!.shareAmountCents).toBe(5000);
    expect(shares[0]!.confirmationStatus).toBe('confirmed');

    // calculateDebts now reads "owner owes sender 5000".
    const summary = calculateDebts(transactions, shares, participants, settlements, owner.id);
    const debt = summary.debts.find((d) => d.debtorId === owner.id && d.creditorId === sender!.id);
    expect(debt?.amountCents).toBe(5000);

    // The inbox item was consumed.
    expect(await getInboundP2pItems()).toHaveLength(0);
  });

  it('acceptInboundDebt is idempotent — a redelivered debt never double-folds', async () => {
    await seedOwner();
    const first = await enqueueDebt(5000);
    await acceptInboundDebt(first, { tripId: TRIP, phaseId: PHASE, budgetPoolId: POOL });

    // Same debtId arrives again (redelivery / re-share) and is accepted again.
    const second = await enqueueDebt(5000);
    const ok = await acceptInboundDebt(second, { tripId: TRIP, phaseId: PHASE, budgetPoolId: POOL });
    expect(ok).toBe(true);

    const { transactions } = await readLedger();
    expect(transactions).toHaveLength(1);
  });

  it('dismissInboundP2p drops a pending item with zero ledger impact', async () => {
    await seedOwner();
    const itemId = await enqueueDebt(5000);
    await dismissInboundP2p(itemId);

    expect(await getInboundP2pItems()).toHaveLength(0);
    const { transactions, settlements } = await readLedger();
    expect(transactions).toHaveLength(0);
    expect(settlements).toHaveLength(0);
  });

  it('confirm payment I RECEIVED (sender "paid"): settles toward me + L8 credits the chosen fund', async () => {
    const owner = await seedOwner();
    const itemId = await enqueuePayment('paid', 3000);

    const ok = await confirmInboundPayment(itemId, {
      tripId: TRIP,
      myParticipantId: owner.id,
      fundCredit: { phaseId: PHASE, budgetPoolId: POOL, walletId: null },
    });
    expect(ok).toBe(true);

    const { settlements, transactions, participants } = await readLedger();
    const sender = participants.find((p) => p.linkedActorId === SENDER)!;

    // Settlement closes the obligation: sender (debtor) → me (creditor).
    expect(settlements).toHaveLength(1);
    expect(settlements[0]!.debtorParticipantId).toBe(sender.id);
    expect(settlements[0]!.creditorParticipantId).toBe(owner.id);
    expect(settlements[0]!.amountCents).toBe(3000);
    expect(settlements[0]!.externalRef).toBe(`payment:${SENDER}:${PAYMENT_ID}`);

    // L8: a real inflow — an income transaction grew the chosen pool.
    const income = transactions.filter((t) => t.type === 'income');
    expect(income).toHaveLength(1);
    expect(income[0]!.amountCents).toBe(3000);
    expect(income[0]!.budgetPoolId).toBe(POOL);
  });

  it('confirm payment I PAID (sender "received"): settles away from me, NO fund credit', async () => {
    const owner = await seedOwner();
    const itemId = await enqueuePayment('received', 2000);

    const ok = await confirmInboundPayment(itemId, { tripId: TRIP, myParticipantId: owner.id });
    expect(ok).toBe(true);

    const { settlements, transactions, participants } = await readLedger();
    const sender = participants.find((p) => p.linkedActorId === SENDER)!;

    expect(settlements).toHaveLength(1);
    expect(settlements[0]!.debtorParticipantId).toBe(owner.id);
    expect(settlements[0]!.creditorParticipantId).toBe(sender.id);
    expect(settlements[0]!.amountCents).toBe(2000);

    // I paid out — no inflow, so no income transaction.
    expect(transactions.filter((t) => t.type === 'income')).toHaveLength(0);
  });

  it('confirmInboundPayment is idempotent — a redelivered payment never double-settles', async () => {
    const owner = await seedOwner();
    const first = await enqueuePayment('received', 2000);
    await confirmInboundPayment(first, { tripId: TRIP, myParticipantId: owner.id });

    const second = await enqueuePayment('received', 2000);
    const ok = await confirmInboundPayment(second, { tripId: TRIP, myParticipantId: owner.id });
    expect(ok).toBe(true);

    const { settlements } = await readLedger();
    expect(settlements).toHaveLength(1);
  });

  // DEC-355 (G8) — group invite: accept-first, read-only. It surfaces as a pending
  // item and accept returns the `/g/` read creds (id+key, NEVER a write token) and
  // clears the inbox; the ledger is untouched (a group never folds money here).
  it('a queued group_invite surfaces as a pending item with its read credentials', async () => {
    await enqueueInvite('g_abc', 'k_xyz', 'Weekend');

    const pending = await getInboundP2pItems();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.kind).toBe('group_invite');
    expect(pending[0]!.invite).toEqual({ v: 1, shareId: 'g_abc', key: 'k_xyz', groupName: 'Weekend' });
    expect(pending[0]!.fromName).toBe('Bruno');
    // G_last (DEC-355): the sender actorId is exposed so the UI can key the
    // per-inviter auto-accept allowlist.
    expect(pending[0]!.fromActorId).toBe(SENDER);
  });

  it('acceptGroupInvite returns the read creds, clears the inbox, and folds NO money', async () => {
    await seedOwner();
    const itemId = await enqueueInvite('g_abc', 'k_xyz', 'Weekend');

    const invite = await acceptGroupInvite(itemId);
    expect(invite).toEqual({ v: 1, shareId: 'g_abc', key: 'k_xyz', groupName: 'Weekend' });

    expect(await getInboundP2pItems()).toHaveLength(0);
    const { transactions, settlements } = await readLedger();
    expect(transactions).toHaveLength(0);
    expect(settlements).toHaveLength(0);
  });

  it('acceptGroupInvite on a missing item returns null (no throw)', async () => {
    expect(await acceptGroupInvite('nope')).toBeNull();
  });
});
