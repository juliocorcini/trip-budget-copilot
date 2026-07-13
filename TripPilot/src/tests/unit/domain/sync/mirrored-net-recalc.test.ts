import { describe, it, expect } from 'vitest';
import {
  buildMirroredStatement,
  answerMirroredLine,
  recalculateMirroredNet,
  buildStatementPayload,
} from '@/domain/sync';
import type { ParticipantStatement } from '@/domain/splitting';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';

/**
 * Guest-side net recalculation after confirm/reject — the field bug where the
 * guest sees a frozen "64 EUR" even after confirming. recalculateMirroredNet
 * recomputes the headline from confirmed lines + settlements, so the displayed
 * balance updates immediately without waiting for the owner to re-publish.
 */

const OWNER_ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PARTICIPANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SHARE_MARKET = '11111111-1111-4111-8111-111111111111';
const SHARE_DINNER = '22222222-2222-4222-8222-222222222222';
const TX_MARKET = '33333333-3333-4333-8333-333333333333';
const TX_DINNER = '44444444-4444-4444-8444-444444444444';

const meta = {
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: OWNER_ACTOR,
};

const participant: Participant = {
  ...meta,
  id: PARTICIPANT_ID,
  tripId: '99999999-9999-4999-8999-999999999999',
  name: 'Cunhado',
  nickname: null,
  isOwner: false,
  email: null,
  linkedUserAccountId: null,
  linkedActorId: null,
};

function mkShare(id: string, txId: string, amountCents: number): ParticipantShare {
  return {
    ...meta,
    id,
    transactionId: txId,
    participantId: PARTICIPANT_ID,
    shareAmountCents: amountCents,
    shareType: 'equal',
    isPaid: false,
    confirmationStatus: 'pending',
    notes: null,
  };
}

const ownerStatement: ParticipantStatement = {
  participantId: PARTICIPANT_ID,
  lines: [
    {
      kind: 'owes',
      transactionId: TX_MARKET,
      sessionId: null,
      description: 'Mercado',
      category: 'groceries',
      subcategoryId: null,
      occurredAt: '2026-07-10T10:00:00.000Z',
      amountCents: 4000,
      currency: 'EUR',
      counterpartyId: 'owner-id',
      counterpartyName: 'Julio',
      confirmationStatus: 'pending',
      isPaid: false,
      placeLabel: null,
      latitude: null,
      longitude: null,
      placeId: null,
      reassignedFromId: null,
      reassignedFromName: null,
    },
    {
      kind: 'owes',
      transactionId: TX_DINNER,
      sessionId: null,
      description: 'Jantar',
      category: 'restaurant',
      subcategoryId: null,
      occurredAt: '2026-07-10T20:00:00.000Z',
      amountCents: 2400,
      currency: 'EUR',
      counterpartyId: 'owner-id',
      counterpartyName: 'Julio',
      confirmationStatus: 'pending',
      isPaid: false,
      placeLabel: null,
      latitude: null,
      longitude: null,
      placeId: null,
      reassignedFromId: null,
      reassignedFromName: null,
    },
  ],
  settlements: [],
  netCents: 0,
  nets: [],
};

const shares = [mkShare(SHARE_MARKET, TX_MARKET, 4000), mkShare(SHARE_DINNER, TX_DINNER, 2400)];

describe('recalculateMirroredNet (guest-side net after confirm/reject)', () => {
  function buildMirror() {
    const payload = buildStatementPayload({
      owner: { actorId: OWNER_ACTOR, displayName: 'Julio' },
      participant,
      statement: ownerStatement,
      shares,
      currency: 'EUR',
    });
    return buildMirroredStatement(payload, null);
  }

  it('starts with net 0 when all lines are pending (owner only sends confirmed nets)', () => {
    const mirror = buildMirror();
    expect(mirror.netCents).toBe(0);
  });

  it('recalculates net after confirming one line — guest now owes that amount', () => {
    let mirror = buildMirror();
    mirror = answerMirroredLine(mirror, SHARE_MARKET, 'confirmed');
    mirror = recalculateMirroredNet(mirror);

    expect(mirror.netCents).toBe(-4000);
    expect(mirror.nets).toEqual([{ currency: 'EUR', amountCents: -4000 }]);
  });

  it('recalculates net after confirming both lines — guest owes the full total', () => {
    let mirror = buildMirror();
    mirror = answerMirroredLine(mirror, SHARE_MARKET, 'confirmed');
    mirror = answerMirroredLine(mirror, SHARE_DINNER, 'confirmed');
    mirror = recalculateMirroredNet(mirror);

    expect(mirror.netCents).toBe(-6400);
    expect(mirror.nets).toEqual([{ currency: 'EUR', amountCents: -6400 }]);
  });

  it('rejecting a line keeps it out of the net', () => {
    let mirror = buildMirror();
    mirror = answerMirroredLine(mirror, SHARE_MARKET, 'confirmed');
    mirror = answerMirroredLine(mirror, SHARE_DINNER, 'rejected');
    mirror = recalculateMirroredNet(mirror);

    expect(mirror.netCents).toBe(-4000);
    expect(mirror.nets).toEqual([{ currency: 'EUR', amountCents: -4000 }]);
  });

  it('multi-currency: each currency bucket recalculated independently', () => {
    const multiCurrencyStatement: ParticipantStatement = {
      participantId: PARTICIPANT_ID,
      lines: [
        {
          ...ownerStatement.lines[0]!,
          currency: 'EUR',
          amountCents: 4000,
        },
        {
          ...ownerStatement.lines[1]!,
          currency: 'BRL',
          amountCents: 38000,
        },
      ],
      settlements: [],
      netCents: 0,
      nets: [],
    };

    const payload = buildStatementPayload({
      owner: { actorId: OWNER_ACTOR, displayName: 'Julio' },
      participant,
      statement: multiCurrencyStatement,
      shares,
      currency: 'EUR',
    });
    let mirror = buildMirroredStatement(payload, null);

    mirror = answerMirroredLine(mirror, SHARE_MARKET, 'confirmed');
    mirror = answerMirroredLine(mirror, SHARE_DINNER, 'confirmed');
    mirror = recalculateMirroredNet(mirror);

    const eurBucket = mirror.nets?.find((b) => b.currency === 'EUR');
    const brlBucket = mirror.nets?.find((b) => b.currency === 'BRL');
    expect(eurBucket?.amountCents).toBe(-4000);
    expect(brlBucket?.amountCents).toBe(-38000);
    expect(mirror.netCents).toBe(-4000 + -38000);
  });

  it('settlements are factored into the recalculated net', () => {
    const statementWithSettlement: ParticipantStatement = {
      ...ownerStatement,
      settlements: [
        {
          ...meta,
          id: 'settle-1',
          tripId: '99999999-9999-4999-8999-999999999999',
          debtorParticipantId: PARTICIPANT_ID,
          creditorParticipantId: 'owner-id',
          amountCents: 2000,
          currency: 'EUR',
          settledAt: '2026-07-11T00:00:00.000Z',
          linkedTransactionId: null,
          notes: null,
        },
      ],
    };

    const payload = buildStatementPayload({
      owner: { actorId: OWNER_ACTOR, displayName: 'Julio' },
      participant,
      statement: statementWithSettlement,
      shares,
      currency: 'EUR',
    });
    let mirror = buildMirroredStatement(payload, null);

    mirror = answerMirroredLine(mirror, SHARE_MARKET, 'confirmed');
    mirror = answerMirroredLine(mirror, SHARE_DINNER, 'confirmed');
    mirror = recalculateMirroredNet(mirror);

    expect(mirror.netCents).toBe(-6400 + 2000);
  });
});
