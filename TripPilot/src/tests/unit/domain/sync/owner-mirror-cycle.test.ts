import { describe, it, expect } from 'vitest';
import {
  buildStatementPayload,
  applyStatementResponses,
  buildMirroredStatement,
  answerMirroredLine,
  clearSentResponses,
} from '@/domain/sync';
import type { ParticipantStatement } from '@/domain/splitting';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';

/**
 * DEC-106 acceptance: the full owner → mirror → confirmation → owner cycle
 * with exact cents, including the offline response queue + flush.
 */

const OWNER_ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEBORA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TX_DINNER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TX_TAXI = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SHARE_DINNER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SHARE_TAXI = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const meta = {
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: OWNER_ACTOR,
};

const debora: Participant = {
  ...meta,
  id: DEBORA_ID,
  tripId: '99999999-9999-4999-8999-999999999999',
  name: 'Debora',
  nickname: null,
  isOwner: false,
  email: null,
  linkedUserAccountId: null,
  linkedActorId: '12121212-1212-4121-8121-121212121212',
};

function share(id: string, transactionId: string, amountCents: number): ParticipantShare {
  return {
    ...meta,
    id,
    transactionId,
    participantId: DEBORA_ID,
    shareAmountCents: amountCents,
    shareType: 'equal',
    isPaid: false,
    confirmationStatus: 'pending',
    notes: null,
  };
}

const ownerShares: ParticipantShare[] = [
  share(SHARE_DINNER, TX_DINNER, 1850),
  share(SHARE_TAXI, TX_TAXI, 725),
];

const ownerStatement: ParticipantStatement = {
  participantId: DEBORA_ID,
  lines: [
    {
      kind: 'owes',
      transactionId: TX_DINNER,
      description: 'Dinner at the harbor',
      category: 'restaurant',
      subcategoryId: null,
      occurredAt: '2026-06-09T21:00:00.000Z',
      amountCents: 1850,
      counterpartyId: '77777777-7777-4777-8777-777777777777',
      counterpartyName: 'Julio',
      confirmationStatus: 'pending',
    },
    {
      kind: 'owes',
      transactionId: TX_TAXI,
      description: 'Taxi back',
      category: 'transport',
      subcategoryId: null,
      occurredAt: '2026-06-09T23:30:00.000Z',
      amountCents: 725,
      counterpartyId: '77777777-7777-4777-8777-777777777777',
      counterpartyName: 'Julio',
      confirmationStatus: 'pending',
    },
  ],
  settlements: [],
  netCents: 0, // nothing confirmed yet
};

describe('owner → mirror → confirmation → owner cycle (DEC-106)', () => {
  it('round-trips confirmations with exact cents and flushes the queue', () => {
    // 1. Owner builds the payload for Debora's paired device.
    const payload = buildStatementPayload({
      owner: { actorId: OWNER_ACTOR, displayName: 'Julio' },
      participant: debora,
      statement: ownerStatement,
      shares: ownerShares,
      currency: 'EUR',
    });
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines.map((l) => l.amountCents)).toEqual([1850, 725]);

    // 2. Mirror stores it and Debora answers both lines (offline — queued).
    let mirror = buildMirroredStatement(payload, null);
    mirror = answerMirroredLine(mirror, SHARE_DINNER, 'confirmed');
    mirror = answerMirroredLine(mirror, SHARE_TAXI, 'rejected');
    expect(mirror.pendingResponses).toHaveLength(2);

    // 3. Next session: queue flushes to the owner.
    const responses = mirror.pendingResponses;
    const updatedShares = applyStatementResponses(ownerShares, DEBORA_ID, responses);

    expect(updatedShares).toHaveLength(2);
    const dinner = updatedShares.find((s) => s.id === SHARE_DINNER)!;
    const taxi = updatedShares.find((s) => s.id === SHARE_TAXI)!;
    expect(dinner.confirmationStatus).toBe('confirmed');
    expect(dinner.shareAmountCents).toBe(1850);
    expect(taxi.confirmationStatus).toBe('rejected');
    expect(taxi.shareAmountCents).toBe(725);
    expect(dinner.revision).toBe(2);

    // 4. Owner acks → mirror clears the queue.
    mirror = clearSentResponses(mirror, responses.map((r) => r.shareId));
    expect(mirror.pendingResponses).toEqual([]);
  });

  it('a replayed response cannot rewrite an already-settled share', () => {
    const settledShares = ownerShares.map((s) => ({
      ...s,
      confirmationStatus: 'confirmed' as const,
    }));
    const updated = applyStatementResponses(settledShares, DEBORA_ID, [
      { shareId: SHARE_DINNER, status: 'rejected' },
    ]);
    expect(updated).toHaveLength(0);
  });
});
