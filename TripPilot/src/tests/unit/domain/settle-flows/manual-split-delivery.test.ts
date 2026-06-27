import { describe, it, expect } from 'vitest';
import { validate as uuidValidate } from 'uuid';
import {
  planManualSplitDeliveries,
  manualSplitDebtId,
  type ManualSplitDeliveryInput,
  type ManualSplitParticipant,
  type ManualSplitShare,
} from '@/domain/settle-flows/manual-split-delivery';

/**
 * DEC-377 (G3, Â-CONSISTENT-SPLIT) — a manual "Registrar gasto" split with a
 * connected person must deliver each slice as an accept-first debt, the SAME way
 * "Dividir conta" does. This is the pure planner that decides WHICH slices to
 * send; the math stays invariant (the debt only lands when the peer accepts).
 */

const TX = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const DAVID = '33333333-3333-4333-8333-333333333333';
const BRUNO = '44444444-4444-4444-8444-444444444444';

function participant(over: Partial<ManualSplitParticipant> & { id: string }): ManualSplitParticipant {
  return {
    isOwner: false,
    linkedActorId: null,
    deletedAt: null,
    ...over,
  };
}

function share(over: Partial<ManualSplitShare> & { participantId: string }): ManualSplitShare {
  return { shareAmountCents: 1000, deletedAt: null, ...over };
}

function input(over: Partial<ManualSplitDeliveryInput>): ManualSplitDeliveryInput {
  return {
    transactionId: TX,
    ownerId: OWNER,
    payerId: OWNER,
    currency: 'BRL',
    description: 'Jantar',
    occurredAt: '2026-06-27T20:00:00.000Z',
    shares: [],
    participants: [],
    ...over,
  };
}

describe('planManualSplitDeliveries (DEC-377)', () => {
  it('delivers a debt to a CONNECTED non-owner whose slice the owner fronted', () => {
    const out = planManualSplitDeliveries(
      input({
        shares: [share({ participantId: OWNER }), share({ participantId: DAVID, shareAmountCents: 2500 })],
        participants: [
          participant({ id: OWNER, isOwner: true }),
          participant({ id: DAVID, linkedActorId: 'actor-david' }),
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      peerActorId: 'actor-david',
      amountCents: 2500,
      currency: 'BRL',
      description: 'Jantar',
      occurredAt: '2026-06-27T20:00:00.000Z',
    });
    expect(uuidValidate(out[0]!.debtId)).toBe(true);
  });

  it('returns nothing when someone OTHER than the owner fronted the money', () => {
    // A non-owner payer means the slice is not a "you owe ME" debt — the owner
    // has no standing to send it; it stays owner-owed locally (DEC-241).
    const out = planManualSplitDeliveries(
      input({
        payerId: DAVID,
        shares: [share({ participantId: DAVID }), share({ participantId: BRUNO })],
        participants: [
          participant({ id: OWNER, isOwner: true }),
          participant({ id: DAVID, linkedActorId: 'actor-david' }),
          participant({ id: BRUNO, linkedActorId: 'actor-bruno' }),
        ],
      }),
    );
    expect(out).toEqual([]);
  });

  it('skips the owner slice, NON-connected people, and non-positive / deleted slices', () => {
    const out = planManualSplitDeliveries(
      input({
        shares: [
          share({ participantId: OWNER, shareAmountCents: 1000 }), // owner: never delivered
          share({ participantId: BRUNO, shareAmountCents: 1000 }), // no linkedActorId → local
          share({ participantId: DAVID, shareAmountCents: 0 }), // zero slice → skip
          share({ participantId: DAVID, shareAmountCents: -500 }), // negative → skip
        ],
        participants: [
          participant({ id: OWNER, isOwner: true }),
          participant({ id: DAVID, linkedActorId: 'actor-david' }),
          participant({ id: BRUNO }), // not connected
        ],
      }),
    );
    expect(out).toEqual([]);
  });

  it('skips a soft-deleted share and a soft-deleted participant', () => {
    const out = planManualSplitDeliveries(
      input({
        shares: [
          share({ participantId: DAVID, shareAmountCents: 1000, deletedAt: '2026-06-27T00:00:00.000Z' }),
          share({ participantId: BRUNO, shareAmountCents: 1000 }),
        ],
        participants: [
          participant({ id: OWNER, isOwner: true }),
          participant({ id: DAVID, linkedActorId: 'actor-david' }),
          participant({ id: BRUNO, linkedActorId: 'actor-bruno', deletedAt: '2026-06-27T00:00:00.000Z' }),
        ],
      }),
    );
    expect(out).toEqual([]);
  });

  it('emits at most ONE debt per person even if they appear in two slices', () => {
    const out = planManualSplitDeliveries(
      input({
        shares: [
          share({ participantId: DAVID, shareAmountCents: 1000 }),
          share({ participantId: DAVID, shareAmountCents: 700 }),
        ],
        participants: [
          participant({ id: OWNER, isOwner: true }),
          participant({ id: DAVID, linkedActorId: 'actor-david' }),
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.peerActorId).toBe('actor-david');
  });
});

describe('manualSplitDebtId (DEC-377 idempotency)', () => {
  it('is DETERMINISTIC — the same (expense, person) always yields the same uuid', () => {
    const a = manualSplitDebtId(TX, DAVID);
    const b = manualSplitDebtId(TX, DAVID);
    expect(a).toBe(b);
    expect(uuidValidate(a)).toBe(true);
  });

  it('differs across people and across expenses (no collisions)', () => {
    expect(manualSplitDebtId(TX, DAVID)).not.toBe(manualSplitDebtId(TX, BRUNO));
    expect(manualSplitDebtId(TX, DAVID)).not.toBe(manualSplitDebtId(OWNER, DAVID));
  });
});
