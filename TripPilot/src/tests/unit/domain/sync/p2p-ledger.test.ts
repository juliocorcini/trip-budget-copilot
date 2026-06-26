import { describe, it, expect } from 'vitest';
import {
  buildSharedDebtPayload,
  parseSharedDebtPayload,
  buildPaymentPayload,
  parsePaymentPayload,
  buildExpenseFromSharedDebt,
  externalRefForDebt,
  resolvePaymentParties,
} from '@/domain/sync';
import {
  buildMailboxEnvelope,
  packEnvelope,
  unpackEnvelope,
} from '@/domain/sync/mailbox-envelope';
import { calculateDebts, createParticipant, createSettlement } from '@/domain/splitting';

// DEC-345/346 (G7) — the live debt/payment pure core. Payloads fail closed (they
// land from the network); the ledger mappers materialize an accepted debt / a
// confirmed payment through the SAME splitting engine (no new money math), so the
// cents are verified end-to-end against calculateDebts.

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

describe('SharedDebtPayload (DEC-345)', () => {
  it('builds + round-trips through the connect-style envelope', () => {
    const debt = buildSharedDebtPayload({
      debtId: A,
      fromActorId: B,
      fromName: 'Bruno',
      currency: 'EUR',
      amountCents: 5000,
      description: 'Jantar',
      occurredAt: '2026-06-20',
    });
    expect(debt.v).toBe(1);
    const env = buildMailboxEnvelope({ kind: 'debt', fromActorId: B, fromName: 'Bruno', data: debt });
    const unpacked = unpackEnvelope(packEnvelope(env));
    expect(unpacked!.kind).toBe('debt');
    expect(parseSharedDebtPayload(unpacked!.data)).toEqual(debt);
  });

  it('fails closed on bad uuid / non-positive amount / 4-letter currency / empty description', () => {
    const base = { debtId: A, fromActorId: B, fromName: 'X', currency: 'EUR', amountCents: 10, description: 'd', occurredAt: null };
    expect(parseSharedDebtPayload({ ...base, debtId: 'nope' })).toBeNull();
    expect(parseSharedDebtPayload({ ...base, amountCents: 0 })).toBeNull();
    expect(parseSharedDebtPayload({ ...base, amountCents: -5 })).toBeNull();
    expect(parseSharedDebtPayload({ ...base, currency: 'EURO' })).toBeNull();
    expect(parseSharedDebtPayload({ ...base, description: '' })).toBeNull();
    expect(parseSharedDebtPayload(null)).toBeNull();
  });
});

describe('PaymentPayload (DEC-346)', () => {
  it('builds + round-trips and validates the direction enum', () => {
    const pay = buildPaymentPayload({
      paymentId: A, fromActorId: B, fromName: 'Bruno', currency: 'EUR', amountCents: 5000, direction: 'paid', note: null,
    });
    const env = buildMailboxEnvelope({ kind: 'payment', fromActorId: B, fromName: 'Bruno', data: pay });
    expect(parsePaymentPayload(unpackEnvelope(packEnvelope(env))!.data)).toEqual(pay);
    expect(parsePaymentPayload({ ...pay, direction: 'sideways' })).toBeNull();
    expect(parsePaymentPayload({ ...pay, amountCents: 0 })).toBeNull();
  });
});

describe('buildExpenseFromSharedDebt → calculateDebts (DEC-345 cents)', () => {
  it('materializes "I owe the sender X" exactly, paid by the sender, my share confirmed', () => {
    const me = createParticipant('trip-1', 'Me', null);
    const peer = createParticipant('trip-1', 'Bruno', null);
    const debt = buildSharedDebtPayload({
      debtId: A, fromActorId: B, fromName: 'Bruno', currency: 'EUR', amountCents: 5000, description: 'Jantar', occurredAt: null,
    });

    const { transaction, shares } = buildExpenseFromSharedDebt({
      debt,
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      creditorParticipantId: peer.id,
      myParticipantId: me.id,
    });

    // The peer is the payer; my single share is the whole amount, confirmed.
    expect(transaction.paidByParticipantId).toBe(peer.id);
    expect(transaction.isShared).toBe(true);
    expect(transaction.walletId).toBeNull();
    expect(transaction.personalCostCents).toBe(5000);
    expect(transaction.externalRef).toBe(externalRefForDebt(debt));
    expect(shares).toHaveLength(1);
    expect(shares[0]!.participantId).toBe(me.id);
    expect(shares[0]!.shareAmountCents).toBe(5000);
    expect(shares[0]!.confirmationStatus).toBe('confirmed');

    // The splitting engine reads it as "I owe Bruno 5000" — exact cents, no new math.
    const summary = calculateDebts([transaction], shares, [me, peer], [], me.id);
    const myDebt = summary.debts.find((d) => d.debtorId === me.id && d.creditorId === peer.id);
    expect(myDebt?.amountCents).toBe(5000);
  });
});

describe('resolvePaymentParties + settlement closes the obligation (DEC-346, never red)', () => {
  it("'paid' makes me the creditor who received; 'received' makes me the debtor", () => {
    expect(resolvePaymentParties({ direction: 'paid', myParticipantId: A, peerParticipantId: B })).toEqual({
      debtorParticipantId: B, creditorParticipantId: A, iReceived: true,
    });
    expect(resolvePaymentParties({ direction: 'received', myParticipantId: A, peerParticipantId: B })).toEqual({
      debtorParticipantId: A, creditorParticipantId: B, iReceived: false,
    });
  });

  it('settling the exact amount nets the debt to zero (never goes red)', () => {
    const me = createParticipant('trip-1', 'Me', null);
    const peer = createParticipant('trip-1', 'Bruno', null);
    const debt = buildSharedDebtPayload({
      debtId: A, fromActorId: B, fromName: 'Bruno', currency: 'EUR', amountCents: 5000, description: 'Jantar', occurredAt: null,
    });
    const { transaction, shares } = buildExpenseFromSharedDebt({
      debt, tripId: 'trip-1', phaseId: 'phase-1', budgetPoolId: 'pool-1', creditorParticipantId: peer.id, myParticipantId: me.id,
    });

    // I (debtor) pay Bruno (creditor) the full 5000.
    const settlement = createSettlement('trip-1', me.id, peer.id, 5000, 'EUR');
    const summary = calculateDebts([transaction], shares, [me, peer], [settlement], me.id);

    // No residual debt either way — closed, never red.
    expect(summary.debts.find((d) => d.debtorId === me.id && d.creditorId === peer.id)).toBeUndefined();
    expect(summary.debts.find((d) => d.debtorId === peer.id && d.creditorId === me.id)).toBeUndefined();
  });
});
