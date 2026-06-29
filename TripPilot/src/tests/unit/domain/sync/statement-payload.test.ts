import { describe, it, expect } from 'vitest';
import { createSyncMetadata } from '@/utils/entity-factory';
import { buildParticipantStatement, createSettlement } from '@/domain/splitting';
import {
  buildStatementPayload,
  buildParticipantSharePayload,
  buildThirdPartyStatementGroups,
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

// DEC-399 — Bruno is the payer on two shared expenses, so the owner (Julio) and a
// third party (Debora) each owe Bruno. The owner shares Bruno's statement: the
// recipient must see ONLY Julio↔Bruno (€74), never the €48 Debora owes Bruno.
function buildLeakFixture() {
  const julio = mkParticipant('Julio', true);
  const bruno = mkParticipant('Bruno', false);
  const debora = mkParticipant('Debora', false);

  const dinner = mkSharedExpense('Dinner', 7400, bruno.id, '2026-06-10');
  const taxi = mkSharedExpense('Taxi', 4800, bruno.id, '2026-06-09');
  const drinks = mkSharedExpense('Drinks', 1000, bruno.id, '2026-06-08');

  const shares = [
    // Julio owes Bruno €74 (the only bilateral owner↔recipient line).
    mkShare(dinner.id, julio.id, 7400, 'confirmed'),
    // Debora owes Bruno €48 confirmed + €10 still pending — third-party only.
    mkShare(taxi.id, debora.id, 4800, 'confirmed'),
    mkShare(drinks.id, debora.id, 1000, 'pending'),
  ];

  return { julio, bruno, debora, transactions: [dinner, taxi, drinks], shares };
}

describe('buildParticipantSharePayload (DEC-399 — ego-centric share link)', () => {
  const ownerActor = { actorId: createSyncMetadata().sourceDeviceId, displayName: 'Julio' };

  it('redacts the headline net + lines to owner↔recipient — never leaks third parties', () => {
    const { julio, bruno, debora, transactions, shares } = buildLeakFixture();

    // The raw (pre-redaction) statement DOES total €122 — proving the leak source.
    const full = buildParticipantStatement(bruno.id, transactions, shares, [julio, bruno, debora], [], julio.id);
    expect(full.netCents).toBe(12200);

    const payload = buildParticipantSharePayload({
      owner: ownerActor,
      ownerParticipantId: julio.id,
      participant: bruno,
      transactions,
      shares,
      participants: [julio, bruno, debora],
      settlements: [],
      currency: 'EUR',
    });

    // Headline is Julio↔Bruno only: €74, a single line, and it's about Julio.
    expect(payload.netCents).toBe(7400);
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0]!.counterpartyName).toBe('Julio');
    expect(payload.lines[0]!.amountCents).toBe(7400);
    // No line mentions Debora.
    expect(payload.lines.some((l) => l.counterpartyName === 'Debora')).toBe(false);
    // QR path (default): no third-party section at all.
    expect(payload.thirdParty).toBeUndefined();
  });

  it('carries third-party debts in a separate, display-only section that stays out of the net', () => {
    const { julio, bruno, debora, transactions, shares } = buildLeakFixture();

    const payload = buildParticipantSharePayload({
      owner: ownerActor,
      ownerParticipantId: julio.id,
      participant: bruno,
      transactions,
      shares,
      participants: [julio, bruno, debora],
      settlements: [],
      currency: 'EUR',
      includeThirdParty: true,
    });

    // Headline is unchanged by attaching third parties.
    expect(payload.netCents).toBe(7400);
    expect(payload.lines).toHaveLength(1);

    // Debora rides along separately: net counts CONFIRMED only (€48, not €58).
    expect(payload.thirdParty).toBeDefined();
    expect(payload.thirdParty).toHaveLength(1);
    const debGroup = payload.thirdParty![0]!;
    expect(debGroup.counterpartyName).toBe('Debora');
    expect(debGroup.netCents).toBe(4800);
    // Both Debora lines (confirmed + pending) are listed, none in the headline.
    expect(debGroup.lines).toHaveLength(2);

    // Round-trips through the Zod schema the mirror validates (thirdParty included).
    expect(parseStatementPayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });
});

describe('buildParticipantSharePayload reconciles settlements + place (DEC-402 · G3)', () => {
  const ownerActor = { actorId: createSyncMetadata().sourceDeviceId, displayName: 'Julio' };

  it('carries the payment as a line so items + payments add up to the net, and each item keeps its place', () => {
    const julio = mkParticipant('Julio', true);
    const debora = mkParticipant('Debora', false);

    // Julio paid two confirmed expenses Debora owes half of: €50 + €20 = €70 owed.
    const dinner = {
      ...mkSharedExpense('Jantar', 10000, julio.id, '2026-06-10'),
      placeLabel: 'Cantina',
      latitude: 38.7,
      longitude: -9.1,
      placeId: 'osm:1',
    };
    const taxi = mkSharedExpense('Taxi', 4000, julio.id, '2026-06-09');
    const shares = [
      mkShare(dinner.id, julio.id, 5000, 'confirmed'),
      mkShare(dinner.id, debora.id, 5000, 'confirmed'),
      mkShare(taxi.id, julio.id, 2000, 'confirmed'),
      mkShare(taxi.id, debora.id, 2000, 'confirmed'),
    ];
    // Debora already paid Julio €20 — the payment that used to be invisible.
    const settlement = createSettlement(TRIP_ID, debora.id, julio.id, 2000, 'EUR');

    const payload = buildParticipantSharePayload({
      owner: ownerActor,
      ownerParticipantId: julio.id,
      participant: debora,
      transactions: [dinner, taxi],
      shares,
      participants: [julio, debora],
      settlements: [settlement],
      currency: 'EUR',
    });

    // Two owes-lines and one payment line: from Debora's POV she PAID €20.
    expect(payload.lines).toHaveLength(2);
    expect(payload.settlements).toBeDefined();
    expect(payload.settlements).toHaveLength(1);
    expect(payload.settlements![0]!.kind).toBe('paid');
    expect(payload.settlements![0]!.amountCents).toBe(2000);

    // RECONCILES: −(50+20) confirmed items + (+20) payment = −50 = the net.
    const lineSum = payload.lines
      .filter((l) => l.confirmationStatus === 'confirmed')
      .reduce((sum, l) => sum + (l.kind === 'owes' ? -l.amountCents : l.amountCents), 0);
    const settleSum = payload.settlements!.reduce(
      (sum, s) => sum + (s.kind === 'paid' ? s.amountCents : -s.amountCents),
      0,
    );
    expect(lineSum + settleSum).toBe(payload.netCents);
    expect(payload.netCents).toBe(-5000);

    // Place rides with the dinner line (display-only); never any internal data.
    const dinnerLine = payload.lines.find((l) => l.transactionId === dinner.id)!;
    expect(dinnerLine.placeLabel).toBe('Cantina');
    expect(dinnerLine.latitude).toBe(38.7);
    expect(dinnerLine.longitude).toBe(-9.1);

    // Round-trips through the Zod schema the mirror validates (settlements + place).
    expect(parseStatementPayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it('omits the settlements field entirely when there are none (older-payload shape)', () => {
    const { julio, debora, transactions, shares } = buildFixture();
    const statement = buildParticipantStatement(debora.id, transactions, shares, [julio, debora], [], julio.id);
    const payload = buildStatementPayload({
      owner: ownerActor,
      participant: debora,
      statement,
      shares,
      currency: 'EUR',
    });
    expect(payload.settlements).toBeUndefined();
  });
});

describe('buildThirdPartyStatementGroups (DEC-399)', () => {
  it('groups non-owner lines by counterparty with a confirmed-only net', () => {
    const { julio, bruno, debora, transactions, shares } = buildLeakFixture();
    const full = buildParticipantStatement(bruno.id, transactions, shares, [julio, bruno, debora], [], julio.id);

    const groups = buildThirdPartyStatementGroups({
      participant: bruno,
      statement: full,
      shares,
      ownerParticipantId: julio.id,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]!.counterpartyName).toBe('Debora');
    expect(groups[0]!.netCents).toBe(4800);
    // The owner (Julio) line is excluded — only third parties are grouped.
    expect(groups.some((g) => g.counterpartyName === 'Julio')).toBe(false);
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
