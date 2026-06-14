import { describe, it, expect } from 'vitest';
import { createSyncMetadata } from '@/utils/entity-factory';
import { buildParticipantStatement } from '@/domain/splitting';
import {
  buildStatementPayload,
  applyStatementResponses,
  parseStatementPayload,
} from '@/domain/sync';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Transaction } from '@/domain/types/transaction';

const TRIP_ID = '11111111-1111-4111-8111-111111111111';

function mkParticipant(name: string, isOwner: boolean): Participant {
  return {
    ...createSyncMetadata(),
    tripId: TRIP_ID,
    name,
    nickname: null,
    isOwner,
    email: null,
    linkedUserAccountId: null,
    linkedActorId: null,
  } as Participant;
}

function mkSharedExpense(
  description: string,
  amountCents: number,
  paidByParticipantId: string,
  date: string,
): Transaction {
  return {
    ...createSyncMetadata(),
    tripId: TRIP_ID,
    phaseId: '22222222-2222-4222-8222-222222222222',
    budgetPoolId: null,
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents,
    personalCostCents: null,
    currency: 'EUR',
    baseCurrencyAmountCents: amountCents,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description,
    date,
    isShared: true,
    paidByParticipantId,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
  };
}

function mkShare(
  transactionId: string,
  participantId: string,
  shareAmountCents: number,
  confirmationStatus: ParticipantShare['confirmationStatus'],
): ParticipantShare {
  return {
    ...createSyncMetadata(),
    transactionId,
    participantId,
    shareAmountCents,
    shareType: 'equal',
    isPaid: false,
    confirmationStatus,
    notes: null,
  };
}

function buildFixture() {
  const julio = mkParticipant('Julio', true);
  const debora = mkParticipant('Debora', false);

  // Julio paid €12 bar (Debora's half pending) and €30 dinner (Debora's
  // share already confirmed); Debora paid €8 taxi (Julio's half pending).
  const bar = mkSharedExpense('Bar do centro', 1200, julio.id, '2026-06-08');
  const dinner = mkSharedExpense('Jantar', 3000, julio.id, '2026-06-07');
  const taxi = mkSharedExpense('Taxi', 800, debora.id, '2026-06-09');

  const shares = [
    mkShare(bar.id, julio.id, 600, 'confirmed'),
    mkShare(bar.id, debora.id, 600, 'pending'),
    mkShare(dinner.id, julio.id, 1500, 'confirmed'),
    mkShare(dinner.id, debora.id, 1500, 'confirmed'),
    mkShare(taxi.id, debora.id, 400, 'confirmed'),
    mkShare(taxi.id, julio.id, 400, 'pending'),
  ];

  return { julio, debora, transactions: [bar, dinner, taxi], shares };
}

describe('buildStatementPayload (DEC-106)', () => {
  it('packs the statement lines with the matching shareIds and exact cents', () => {
    const { julio, debora, transactions, shares } = buildFixture();
    const statement = buildParticipantStatement(
      debora.id,
      transactions,
      shares,
      [julio, debora],
      [],
      julio.id,
    );

    const payload = buildStatementPayload({
      owner: { actorId: createSyncMetadata().sourceDeviceId, displayName: 'Julio' },
      participant: debora,
      statement,
      shares,
      currency: 'EUR',
    });

    expect(payload.v).toBe(1);
    expect(payload.currency).toBe('EUR');
    expect(payload.lines).toHaveLength(3);

    const pendingOwes = payload.lines.find((l) => l.confirmationStatus === 'pending' && l.kind === 'owes');
    expect(pendingOwes).toBeDefined();
    expect(pendingOwes!.amountCents).toBe(600);
    expect(pendingOwes!.description).toBe('Bar do centro');

    const deboraShareIds = shares
      .filter((s) => s.participantId === debora.id)
      .map((s) => s.id);
    for (const line of payload.lines.filter((l) => l.kind === 'owes')) {
      expect(deboraShareIds).toContain(line.shareId);
    }

    // Net counts CONFIRMED lines only → dinner (−1500); the bar share and
    // Julio's taxi share are still pending and stay out of the net.
    expect(payload.netCents).toBe(-1500);

    // Round-trips through the Zod schema (what the mirror device validates).
    expect(parseStatementPayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });
});

describe('applyStatementResponses (DEC-106)', () => {
  it('confirms and rejects exactly the pending shares of the paired participant', () => {
    const { debora, shares } = buildFixture();
    const pendingDebora = shares.find(
      (s) => s.participantId === debora.id && s.confirmationStatus === 'pending',
    )!;
    const confirmedDebora = shares.find(
      (s) => s.participantId === debora.id && s.confirmationStatus === 'confirmed',
    )!;

    const updated = applyStatementResponses(shares, debora.id, [
      { shareId: pendingDebora.id, status: 'confirmed' },
      // Already-confirmed share must be ignored (money never rewritten).
      { shareId: confirmedDebora.id, status: 'rejected' },
      // Unknown share id must be ignored.
      { shareId: '99999999-9999-4999-8999-999999999999', status: 'confirmed' },
    ]);

    expect(updated).toHaveLength(1);
    expect(updated[0]!.id).toBe(pendingDebora.id);
    expect(updated[0]!.confirmationStatus).toBe('confirmed');
    expect(updated[0]!.shareAmountCents).toBe(600);
    expect(updated[0]!.revision).toBe(pendingDebora.revision + 1);
  });

  it('ignores responses targeting shares of OTHER participants', () => {
    const { julio, debora, shares } = buildFixture();
    const julioPending = shares.find(
      (s) => s.participantId === julio.id && s.confirmationStatus === 'pending',
    )!;

    // A response from Debora's device can never touch Julio's own share.
    const updated = applyStatementResponses(shares, debora.id, [
      { shareId: julioPending.id, status: 'rejected' },
    ]);
    expect(updated).toHaveLength(0);
  });

  it('rejecting a pending share keeps amounts intact and only flips status', () => {
    const { debora, shares } = buildFixture();
    const pending = shares.find(
      (s) => s.participantId === debora.id && s.confirmationStatus === 'pending',
    )!;
    const updated = applyStatementResponses(shares, debora.id, [
      { shareId: pending.id, status: 'rejected' },
    ]);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.confirmationStatus).toBe('rejected');
    expect(updated[0]!.shareAmountCents).toBe(pending.shareAmountCents);
  });
});
