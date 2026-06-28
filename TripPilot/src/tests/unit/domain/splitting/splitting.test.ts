import { describe, it, expect } from 'vitest';
import {
  createEqualShares,
  createCustomShares,
  calculatePersonalCost,
  calculateDebts,
  createSettlement,
  createParticipant,
  scaleSharesToTotal,
  calculateParticipantBalances,
  ownerPairwiseBalances,
  findPendingConfirmationShares,
  calculateOwnerPersonalCost,
  suggestSimplifiedSettlements,
  buildParticipantStatement,
  filterStatementToCounterparty,
  thirdPartyDebts,
  ownerInvolvedDebts,
  summarizeOwnerDebts,
} from '@/domain/splitting';
import type { DebtEntry } from '@/domain/splitting';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';
import type { Settlement } from '@/domain/types/settlement';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

describe('createEqualShares', () => {
  it('splits €60 among 3 people equally', () => {
    const shares = createEqualShares('tx-1', ['p1', 'p2', 'p3'], 6000);
    expect(shares).toHaveLength(3);
    expect(shares[0]!.shareAmountCents).toBe(2000);
    expect(shares[1]!.shareAmountCents).toBe(2000);
    expect(shares[2]!.shareAmountCents).toBe(2000);
    expect(shares.reduce((s, sh) => s + sh.shareAmountCents, 0)).toBe(6000);
  });

  it('handles remainder correctly', () => {
    const shares = createEqualShares('tx-1', ['p1', 'p2', 'p3'], 1000);
    expect(shares[0]!.shareAmountCents).toBe(334);
    expect(shares[1]!.shareAmountCents).toBe(333);
    expect(shares[2]!.shareAmountCents).toBe(333);
    expect(shares.reduce((s, sh) => s + sh.shareAmountCents, 0)).toBe(1000);
  });

  it('sets shareType to equal', () => {
    const shares = createEqualShares('tx-1', ['p1'], 100);
    expect(shares[0]!.shareType).toBe('equal');
  });
});

describe('createCustomShares', () => {
  it('creates shares with custom amounts', () => {
    const shares = createCustomShares('tx-1', [
      { participantId: 'p1', amountCents: 4000 },
      { participantId: 'p2', amountCents: 2000 },
    ]);
    expect(shares).toHaveLength(2);
    expect(shares[0]!.shareAmountCents).toBe(4000);
    expect(shares[1]!.shareAmountCents).toBe(2000);
    expect(shares[0]!.shareType).toBe('custom');
  });
});

describe('calculatePersonalCost', () => {
  it('returns owner share amount', () => {
    const shares: ParticipantShare[] = [
      { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'owner', shareAmountCents: 2000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
      { ...meta, id: 's2', transactionId: 'tx-1', participantId: 'friend', shareAmountCents: 2000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
    ];
    expect(calculatePersonalCost(shares, 'owner')).toBe(2000);
  });

  it('returns 0 when owner not in shares', () => {
    const shares: ParticipantShare[] = [
      { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'other', shareAmountCents: 1000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
    ];
    expect(calculatePersonalCost(shares, 'owner')).toBe(0);
  });
});

describe('calculateDebts', () => {
  const participants: Participant[] = [
    { ...meta, id: 'julio', tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null },
    { ...meta, id: 'ana', tripId: 'trip-1', name: 'Ana', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
  ];

  it('calculates debt when owner paid shared expense', () => {
    const tx: Transaction = {
      ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1',
      budgetPoolId: 'pool-1', walletId: null, sessionId: null,
      type: 'expense', amountCents: 6000, personalCostCents: 3000,
      currency: 'EUR', baseCurrencyAmountCents: 6000, exchangeRate: null,
      category: 'market', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'Mercadona', date: '2026-07-01T00:00:00.000Z',
      isShared: true, paidByParticipantId: null,
      activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
      sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
    };
    const shares: ParticipantShare[] = [
      { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'julio', shareAmountCents: 3000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
      { ...meta, id: 's2', transactionId: 'tx-1', participantId: 'ana', shareAmountCents: 3000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
    ];
    const result = calculateDebts([tx], shares, participants, [], 'julio');
    expect(result.debts).toHaveLength(1);
    expect(result.debts[0]!.debtorId).toBe('ana');
    expect(result.debts[0]!.creditorId).toBe('julio');
    expect(result.debts[0]!.amountCents).toBe(3000);
  });

  it('reduces debt with settlement', () => {
    const tx: Transaction = {
      ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1',
      budgetPoolId: 'pool-1', walletId: null, sessionId: null,
      type: 'expense', amountCents: 6000, personalCostCents: 3000,
      currency: 'EUR', baseCurrencyAmountCents: 6000, exchangeRate: null,
      category: 'market', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'Test', date: '2026-07-01T00:00:00.000Z',
      isShared: true, paidByParticipantId: null,
      activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
      sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
    };
    const shares: ParticipantShare[] = [
      { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'julio', shareAmountCents: 3000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
      { ...meta, id: 's2', transactionId: 'tx-1', participantId: 'ana', shareAmountCents: 3000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
    ];
    const settlements = [
      { ...meta, id: 'set-1', tripId: 'trip-1', debtorParticipantId: 'ana', creditorParticipantId: 'julio', amountCents: 2000, currency: 'EUR', settledAt: '2026-07-02T00:00:00.000Z', linkedTransactionId: null, notes: null },
    ];
    const result = calculateDebts([tx], shares, participants, settlements, 'julio');
    expect(result.debts[0]!.amountCents).toBe(1000);
  });
});

describe('share confirmation (DEC-071 / FIELD-03)', () => {
  const participants: Participant[] = [
    { ...meta, id: 'julio', tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null },
    { ...meta, id: 'sis', tripId: 'trip-1', name: 'Irmã', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
  ];

  const baseTx: Transaction = {
    ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1',
    budgetPoolId: 'pool-1', walletId: null, sessionId: null,
    type: 'expense', amountCents: 4000, personalCostCents: 2000,
    currency: 'EUR', baseCurrencyAmountCents: 4000, exchangeRate: null,
    category: 'market', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'Mercado 1', date: '2026-07-01T00:00:00.000Z',
    isShared: true, paidByParticipantId: 'julio',
    activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
    sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
  };

  function mkShare(id: string, txId: string, participantId: string, status: ParticipantShare['confirmationStatus']): ParticipantShare {
    return { ...meta, id, transactionId: txId, participantId, shareAmountCents: 2000, shareType: 'equal', isPaid: false, confirmationStatus: status, notes: null };
  }

  // The exact field report: two €40 markets, each paid by one sibling and
  // split 50/50 — crossed €20 debts that net out.
  const tx1 = baseTx;
  const tx2: Transaction = { ...baseTx, id: 'tx-2', description: 'Mercado 2', paidByParticipantId: 'sis' };

  it('sister scenario: pending shares do not consolidate into debts', () => {
    const shares = [
      mkShare('s1', 'tx-1', 'julio', 'confirmed'),
      mkShare('s2', 'tx-1', 'sis', 'pending'),
      mkShare('s3', 'tx-2', 'sis', 'confirmed'),
      mkShare('s4', 'tx-2', 'julio', 'pending'),
    ];
    const result = calculateDebts([tx1, tx2], shares, participants, [], 'julio');
    expect(result.debts).toHaveLength(0);

    const pending = findPendingConfirmationShares([tx1, tx2], shares, 'julio');
    expect(pending).toHaveLength(2);
    expect(pending.map((p) => p.share.id).sort()).toEqual(['s2', 's4']);
  });

  it('sister scenario: confirming both crossed shares keeps debts netted at zero', () => {
    const shares = [
      mkShare('s1', 'tx-1', 'julio', 'confirmed'),
      mkShare('s2', 'tx-1', 'sis', 'confirmed'),
      mkShare('s3', 'tx-2', 'sis', 'confirmed'),
      mkShare('s4', 'tx-2', 'julio', 'confirmed'),
    ];
    // 2×€20 crossed debts net out — the card disappears, debts stay zero.
    const result = calculateDebts([tx1, tx2], shares, participants, [], 'julio');
    expect(result.debts).toHaveLength(0);
    expect(findPendingConfirmationShares([tx1, tx2], shares, 'julio')).toHaveLength(0);
  });

  it('counts only third-party pending shares (payer share never pends)', () => {
    const shares = [
      mkShare('s1', 'tx-1', 'julio', 'pending'),
      mkShare('s2', 'tx-1', 'sis', 'pending'),
    ];
    const pending = findPendingConfirmationShares([tx1], shares, 'julio');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.share.id).toBe('s2');
  });

  it('rejected shares do not enter debts', () => {
    const shares = [
      mkShare('s1', 'tx-1', 'julio', 'confirmed'),
      mkShare('s2', 'tx-1', 'sis', 'rejected'),
    ];
    const result = calculateDebts([tx1], shares, participants, [], 'julio');
    expect(result.debts).toHaveLength(0);
  });

  it('ignores non-shared and deleted transactions', () => {
    const personalTx = { ...baseTx, id: 'tx-3', isShared: false };
    const deletedTx = { ...baseTx, id: 'tx-4', deletedAt: '2026-07-02T00:00:00.000Z' };
    const shares = [mkShare('s1', 'tx-3', 'sis', 'pending'), mkShare('s2', 'tx-4', 'sis', 'pending')];
    expect(findPendingConfirmationShares([personalTx, deletedTx], shares, 'julio')).toHaveLength(0);
  });
});

describe('calculateOwnerPersonalCost (DEC-071)', () => {
  const tx: Transaction = {
    ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1',
    budgetPoolId: 'pool-1', walletId: null, sessionId: null,
    type: 'expense', amountCents: 4000, personalCostCents: 2000,
    currency: 'EUR', baseCurrencyAmountCents: 4000, exchangeRate: null,
    category: 'market', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'Mercado', date: '2026-07-01T00:00:00.000Z',
    isShared: true, paidByParticipantId: 'julio',
    activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
    sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
  };

  function mkShare(id: string, participantId: string, cents: number, status: ParticipantShare['confirmationStatus']): ParticipantShare {
    return { ...meta, id, transactionId: 'tx-1', participantId, shareAmountCents: cents, shareType: 'equal', isPaid: false, confirmationStatus: status, notes: null };
  }

  it('owner paid: pending/confirmed third-party shares reduce the personal cost', () => {
    const shares = [mkShare('s1', 'julio', 2000, 'confirmed'), mkShare('s2', 'sis', 2000, 'pending')];
    expect(calculateOwnerPersonalCost(tx, shares, 'julio')).toBe(2000);
  });

  it('owner paid: a rejected share returns its value to the payer (€40 - rejected €20 = €40)', () => {
    const shares = [mkShare('s1', 'julio', 2000, 'confirmed'), mkShare('s2', 'sis', 2000, 'rejected')];
    expect(calculateOwnerPersonalCost(tx, shares, 'julio')).toBe(4000);
  });

  it('owner paid: adjusted confirmed share shifts the difference to the payer', () => {
    const shares = [mkShare('s1', 'julio', 2000, 'confirmed'), mkShare('s2', 'sis', 1500, 'confirmed')];
    expect(calculateOwnerPersonalCost(tx, shares, 'julio')).toBe(2500);
  });

  it('someone else paid: owner cost is their own non-rejected share', () => {
    const paidBySis = { ...tx, paidByParticipantId: 'sis' };
    const shares = [mkShare('s1', 'sis', 2000, 'confirmed'), mkShare('s2', 'julio', 2000, 'pending')];
    expect(calculateOwnerPersonalCost(paidBySis, shares, 'julio')).toBe(2000);
  });

  it('someone else paid: a rejected own share zeroes the owner cost', () => {
    const paidBySis = { ...tx, paidByParticipantId: 'sis' };
    const shares = [mkShare('s1', 'sis', 2000, 'confirmed'), mkShare('s2', 'julio', 2000, 'rejected')];
    expect(calculateOwnerPersonalCost(paidBySis, shares, 'julio')).toBe(0);
  });
});

describe('createSettlement', () => {
  it('creates settlement entity', () => {
    const s = createSettlement('trip-1', 'ana', 'julio', 3000, 'EUR');
    expect(s.debtorParticipantId).toBe('ana');
    expect(s.creditorParticipantId).toBe('julio');
    expect(s.amountCents).toBe(3000);
    expect(s.settledAt).toBeTruthy();
  });
});

describe('createParticipant', () => {
  it('creates a non-owner participant with name and nickname', () => {
    const p = createParticipant('trip-1', 'Ana Silva', 'Aninha');
    expect(p.tripId).toBe('trip-1');
    expect(p.name).toBe('Ana Silva');
    expect(p.nickname).toBe('Aninha');
    expect(p.isOwner).toBe(false);
    expect(p.deletedAt).toBeNull();
  });

  it('accepts null nickname', () => {
    const p = createParticipant('trip-1', 'Ana', null);
    expect(p.nickname).toBeNull();
  });
});

describe('scaleSharesToTotal', () => {
  const mkShare = (id: string, participantId: string, amount: number): ParticipantShare => ({
    ...meta,
    id,
    transactionId: 'tx-1',
    participantId,
    shareAmountCents: amount,
    shareType: 'equal',
    confirmationStatus: 'confirmed',
    isPaid: false,
    notes: null,
  });

  it('scales shares proportionally when total changes', () => {
    const shares = [mkShare('s1', 'p1', 2000), mkShare('s2', 'p2', 2000), mkShare('s3', 'p3', 2000)];
    const scaled = scaleSharesToTotal(shares, 9000);
    expect(scaled[0]!.shareAmountCents).toBe(3000);
    expect(scaled[1]!.shareAmountCents).toBe(3000);
    expect(scaled[2]!.shareAmountCents).toBe(3000);
  });

  it('keeps the sum exact, last share absorbs rounding', () => {
    const shares = [mkShare('s1', 'p1', 3333), mkShare('s2', 'p2', 3333), mkShare('s3', 'p3', 3334)];
    const scaled = scaleSharesToTotal(shares, 5000);
    expect(scaled.reduce((sum, s) => sum + s.shareAmountCents, 0)).toBe(5000);
  });

  it('preserves proportions for uneven shares', () => {
    // p1 had 2/3, p2 had 1/3 of €60 → scaling to €90 keeps the ratio
    const shares = [mkShare('s1', 'p1', 4000), mkShare('s2', 'p2', 2000)];
    const scaled = scaleSharesToTotal(shares, 9000);
    expect(scaled[0]!.shareAmountCents).toBe(6000);
    expect(scaled[1]!.shareAmountCents).toBe(3000);
  });
});

describe('suggestSimplifiedSettlements (GAP-032)', () => {
  const debt = (
    debtorId: string,
    creditorId: string,
    amountCents: number,
  ): DebtEntry => ({
    debtorId,
    debtorName: debtorId.toUpperCase(),
    creditorId,
    creditorName: creditorId.toUpperCase(),
    amountCents,
  });

  it('collapses a chain A→B→C into a single transfer A→C', () => {
    // A owes B €10 and B owes C €10 → A pays C €10 directly.
    const result = suggestSimplifiedSettlements([
      debt('a', 'b', 1000),
      debt('b', 'c', 1000),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ debtorId: 'a', creditorId: 'c', amountCents: 1000 });
  });

  it('reduces crossed debts among 3 participants', () => {
    // A owes B €30, B owes C €20, C owes A €10.
    // Net: A -20, B +10, C +10 → 2 transfers instead of 3.
    const result = suggestSimplifiedSettlements([
      debt('a', 'b', 3000),
      debt('b', 'c', 2000),
      debt('c', 'a', 1000),
    ]);
    expect(result).toHaveLength(2);
    const total = result.reduce((sum, d) => sum + d.amountCents, 0);
    expect(total).toBe(2000);
    expect(result.every((d) => d.debtorId === 'a')).toBe(true);
  });

  it('keeps a single debt unchanged', () => {
    const result = suggestSimplifiedSettlements([debt('a', 'b', 500)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ debtorId: 'a', creditorId: 'b', amountCents: 500 });
  });

  it('preserves the total amount owed across simplification', () => {
    const debts = [
      debt('a', 'b', 1700),
      debt('b', 'c', 900),
      debt('c', 'd', 400),
      debt('d', 'a', 250),
    ];
    const result = suggestSimplifiedSettlements(debts);
    const netOut = new Map<string, number>();
    for (const d of debts) {
      netOut.set(d.debtorId, (netOut.get(d.debtorId) ?? 0) + d.amountCents);
      netOut.set(d.creditorId, (netOut.get(d.creditorId) ?? 0) - d.amountCents);
    }
    for (const r of result) {
      netOut.set(r.debtorId, (netOut.get(r.debtorId) ?? 0) - r.amountCents);
      netOut.set(r.creditorId, (netOut.get(r.creditorId) ?? 0) + r.amountCents);
    }
    for (const value of netOut.values()) expect(value).toBe(0);
  });
});

describe('thirdPartyDebts / ownerInvolvedDebts (DEC-388 · G6 · S-EGO)', () => {
  const debt = (
    debtorId: string,
    creditorId: string,
    amountCents: number,
  ): DebtEntry => ({
    debtorId,
    debtorName: debtorId.toUpperCase(),
    creditorId,
    creditorName: creditorId.toUpperCase(),
    amountCents,
  });

  const OWNER = 'julio';
  // A real settle graph: someone owes the owner, the owner owes someone, and a
  // pure third-party pair (Débora → Bruno) the owner only sees because they
  // recorded it.
  const graph: DebtEntry[] = [
    debt('ana', OWNER, 3000), // Ana owes me
    debt(OWNER, 'leo', 1200), // I owe Leo
    debt('debora', 'bruno', 4900), // none of my business
  ];

  it('thirdPartyDebts keeps only pairs with neither side the owner', () => {
    const result = thirdPartyDebts(graph, OWNER);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ debtorId: 'debora', creditorId: 'bruno', amountCents: 4900 });
  });

  it('ownerInvolvedDebts keeps only pairs the owner is a party to', () => {
    const result = ownerInvolvedDebts(graph, OWNER);
    expect(result).toHaveLength(2);
    expect(result.some((d) => d.creditorId === OWNER && d.debtorId === 'ana')).toBe(true);
    expect(result.some((d) => d.debtorId === OWNER && d.creditorId === 'leo')).toBe(true);
    expect(result.some((d) => d.debtorId === 'debora')).toBe(false);
  });

  it('partitions the graph with nothing lost or double-counted', () => {
    const owner = ownerInvolvedDebts(graph, OWNER);
    const third = thirdPartyDebts(graph, OWNER);
    expect(owner.length + third.length).toBe(graph.length);
    // Every original debt lands in exactly one bucket.
    const recombined = [...owner, ...third];
    expect(recombined).toHaveLength(graph.length);
    const total = recombined.reduce((s, d) => s + d.amountCents, 0);
    expect(total).toBe(graph.reduce((s, d) => s + d.amountCents, 0));
  });

  it('drops zero / non-positive amounts from both sides', () => {
    const noisy = [debt('ana', OWNER, 0), debt('debora', 'bruno', 0), debt('ana', OWNER, 500)];
    expect(ownerInvolvedDebts(noisy, OWNER)).toHaveLength(1);
    expect(thirdPartyDebts(noisy, OWNER)).toHaveLength(0);
  });

  it('owner-net is faithful: summarizeOwnerDebts(ownerInvolvedDebts) == baseline net', () => {
    // The ego-centric list must never change the owner's bottom line.
    const baselineNet = summarizeOwnerDebts(graph, OWNER).netCents;
    const egoNet = summarizeOwnerDebts(ownerInvolvedDebts(graph, OWNER), OWNER).netCents;
    expect(egoNet).toBe(baselineNet);
    // 3000 received − 1200 paid = +1800.
    expect(egoNet).toBe(1800);
  });

  it('matches a real calculateDebts graph: a non-owner-paid split is third-party', () => {
    const participants: Participant[] = [
      { ...meta, id: OWNER, tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null },
      { ...meta, id: 'bruno', tripId: 'trip-1', name: 'Bruno', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
      { ...meta, id: 'debora', tripId: 'trip-1', name: 'Débora', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
    ];
    // Bruno paid €98, split equally with Débora — the owner is NOT a participant.
    const tx: Transaction = {
      ...meta, id: 'tx-tp', tripId: 'trip-1', phaseId: 'ph-1',
      budgetPoolId: 'pool-1', walletId: null, sessionId: null,
      type: 'expense', amountCents: 9800, personalCostCents: null,
      currency: 'EUR', baseCurrencyAmountCents: 9800, exchangeRate: null,
      category: 'bar', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'Bar', date: '2026-07-01T00:00:00.000Z',
      isShared: true, paidByParticipantId: 'bruno',
      activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
      sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
    };
    const shares: ParticipantShare[] = [
      { ...meta, id: 's1', transactionId: 'tx-tp', participantId: 'bruno', shareAmountCents: 4900, shareType: 'equal', isPaid: true, confirmationStatus: 'confirmed', notes: null },
      { ...meta, id: 's2', transactionId: 'tx-tp', participantId: 'debora', shareAmountCents: 4900, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
    ];
    const { debts } = calculateDebts([tx], shares, participants, [], OWNER);
    expect(ownerInvolvedDebts(debts, OWNER)).toHaveLength(0);
    const third = thirdPartyDebts(debts, OWNER);
    expect(third).toHaveLength(1);
    expect(third[0]).toMatchObject({ debtorId: 'debora', creditorId: 'bruno', amountCents: 4900 });
  });
});

describe('calculateParticipantBalances', () => {
  it('computes net balances from debts', () => {
    const balances = calculateParticipantBalances([
      { debtorId: 'ana', debtorName: 'Ana', creditorId: 'julio', creditorName: 'Julio', amountCents: 3000 },
      { debtorId: 'leo', debtorName: 'Leo', creditorId: 'julio', creditorName: 'Julio', amountCents: 1500 },
    ]);
    expect(balances.get('julio')).toBe(4500);
    expect(balances.get('ana')).toBe(-3000);
    expect(balances.get('leo')).toBe(-1500);
  });

  it('returns empty map when there are no debts', () => {
    expect(calculateParticipantBalances([]).size).toBe(0);
  });
});

describe('ownerPairwiseBalances + filterStatementToCounterparty (DEC-394 · G4 · S-EGO-PEOPLE)', () => {
  const OWNER = 'julio';
  const participants: Participant[] = [
    { ...meta, id: OWNER, tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null },
    { ...meta, id: 'ana', tripId: 'trip-1', name: 'Ana', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
    { ...meta, id: 'bruno', tripId: 'trip-1', name: 'Bruno', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
    { ...meta, id: 'debora', tripId: 'trip-1', name: 'Débora', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
  ];

  const mkTx = (id: string, payerId: string | null): Transaction => ({
    ...meta, id, tripId: 'trip-1', phaseId: 'ph-1',
    budgetPoolId: 'pool-1', walletId: null, sessionId: null,
    type: 'expense', amountCents: 20000, personalCostCents: null,
    currency: 'EUR', baseCurrencyAmountCents: 20000, exchangeRate: null,
    category: 'bar', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null,
    description: id, date: '2026-07-01T00:00:00.000Z',
    isShared: true, paidByParticipantId: payerId,
    activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
    sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
  });

  const mkShare = (
    id: string,
    txId: string,
    participantId: string,
    cents: number,
    status: ParticipantShare['confirmationStatus'] = 'confirmed',
  ): ParticipantShare => ({
    ...meta, id, transactionId: txId, participantId, shareAmountCents: cents,
    shareType: 'equal', isPaid: false, confirmationStatus: status, notes: null,
  });

  const mkSettlement = (
    id: string,
    debtorId: string,
    creditorId: string,
    cents: number,
  ): Settlement => ({
    ...meta, id, tripId: 'trip-1', debtorParticipantId: debtorId, creditorParticipantId: creditorId,
    amountCents: cents, currency: 'EUR', settledAt: '2026-07-02T00:00:00.000Z', linkedTransactionId: null, notes: null,
  });

  // The keystone scenario: I paid for Ana (Ana owes me) AND Bruno paid for Débora
  // (a pure third-party debt I only recorded). The min-transfer can route my
  // receivable through Bruno/Débora and mislabel them.
  const txOwnerPaid = mkTx('tx-owner', OWNER); // owner paid, split owner+Ana
  const txThirdParty = mkTx('tx-3p', 'bruno'); // Bruno paid, split Bruno+Débora
  const shares: ParticipantShare[] = [
    mkShare('s1', 'tx-owner', OWNER, 10000),
    mkShare('s2', 'tx-owner', 'ana', 10000),
    mkShare('s3', 'tx-3p', 'bruno', 10000),
    mkShare('s4', 'tx-3p', 'debora', 10000),
  ];

  it('keeps only owner↔person edges — Ana owes me, third-party Bruno/Débora are 0', () => {
    const balances = ownerPairwiseBalances([txOwnerPaid, txThirdParty], shares, [], OWNER);
    expect(balances.get('ana')).toBe(-10000); // negative = Ana owes the owner
    expect(balances.get('bruno') ?? 0).toBe(0); // a third-party creditor — not my business
    expect(balances.get('debora') ?? 0).toBe(0); // a third-party debtor — not my business
  });

  it('is FAITHFUL where the min-transfer leaks: a third party gets a phantom balance', () => {
    const { debts } = calculateDebts([txOwnerPaid, txThirdParty], shares, participants, [], OWNER);
    const minTransfer = calculateParticipantBalances(debts);
    const pairwise = ownerPairwiseBalances([txOwnerPaid, txThirdParty], shares, [], OWNER);
    // The OLD path routes my receivable through the third-party pair, so at least
    // one non-owner-related person shows a non-zero balance ("Bruno recebe …").
    const leaked = (minTransfer.get('bruno') ?? 0) !== 0 || (minTransfer.get('debora') ?? 0) !== 0;
    expect(leaked).toBe(true);
    // The faithful pairwise keeps those same people at 0.
    expect(pairwise.get('bruno') ?? 0).toBe(0);
    expect(pairwise.get('debora') ?? 0).toBe(0);
  });

  it('A6 invariance: −Σ pairwise == the owner net from summarizeOwnerDebts (== baseline)', () => {
    const { debts } = calculateDebts([txOwnerPaid, txThirdParty], shares, participants, [], OWNER);
    const pairwise = ownerPairwiseBalances([txOwnerPaid, txThirdParty], shares, [], OWNER);
    const pairwiseOwnerNet = -[...pairwise.values()].reduce((a, b) => a + b, 0);
    expect(pairwiseOwnerNet).toBe(summarizeOwnerDebts(debts, OWNER).netCents);
    expect(pairwiseOwnerNet).toBe(10000); // I am owed €100 net, regardless of routing
  });

  it('owner-as-debtor reads positive (the person receives)', () => {
    const txAnaPaid = mkTx('tx-ana', 'ana'); // Ana paid, split owner+Ana → I owe Ana
    const anaShares = [mkShare('a1', 'tx-ana', OWNER, 10000), mkShare('a2', 'tx-ana', 'ana', 10000)];
    const balances = ownerPairwiseBalances([txAnaPaid], anaShares, [], OWNER);
    expect(balances.get('ana')).toBe(10000); // positive = Ana receives (I owe Ana)
  });

  it('applies owner↔person settlements and ignores third-party ones; pending shares excluded', () => {
    const pendingTx = mkTx('tx-pend', OWNER);
    const withPending = [
      ...shares,
      mkShare('p1', 'tx-pend', OWNER, 5000),
      mkShare('p2', 'tx-pend', 'ana', 5000, 'pending'), // not yet confirmed → ignored
    ];
    const settlements: Settlement[] = [
      mkSettlement('set-1', 'ana', OWNER, 4000), // Ana paid me back €40 → her debt shrinks
      mkSettlement('set-2', 'debora', 'bruno', 9000), // third-party settlement → ignored
    ];
    const balances = ownerPairwiseBalances([txOwnerPaid, txThirdParty, pendingTx], withPending, settlements, OWNER);
    expect(balances.get('ana')).toBe(-6000); // −10000 + 4000 settled; pending €50 not counted
    expect(balances.get('bruno') ?? 0).toBe(0);
    expect(balances.get('debora') ?? 0).toBe(0);
  });

  it('filterStatementToCounterparty drops third-party lines and matches the pairwise net', () => {
    // Débora owes ME (I paid) AND owes Bruno (he paid) — her profile must show only us.
    const txIPaidForDebora = mkTx('tx-id', OWNER);
    const txBrunoPaidForDebora = mkTx('tx-bd', 'bruno');
    const dShares = [
      mkShare('d1', 'tx-id', OWNER, 10000),
      mkShare('d2', 'tx-id', 'debora', 10000),
      mkShare('d3', 'tx-bd', 'bruno', 10000),
      mkShare('d4', 'tx-bd', 'debora', 10000),
    ];
    const full = buildParticipantStatement('debora', [txIPaidForDebora, txBrunoPaidForDebora], dShares, participants, [], OWNER);
    expect(full.lines).toHaveLength(2); // owes me + owes Bruno
    expect(full.netCents).toBe(-20000);

    const ownerOnly = filterStatementToCounterparty(full, OWNER);
    expect(ownerOnly.lines).toHaveLength(1);
    expect(ownerOnly.lines[0]!.counterpartyId).toBe(OWNER);
    expect(ownerOnly.netCents).toBe(-10000);

    const pairwise = ownerPairwiseBalances([txIPaidForDebora, txBrunoPaidForDebora], dShares, [], OWNER);
    expect(ownerOnly.netCents).toBe(pairwise.get('debora'));
  });
});

describe('buildParticipantStatement (DEC-102 / R-25)', () => {
  const participants: Participant[] = [
    { ...meta, id: 'julio', tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null },
    { ...meta, id: 'debora', tripId: 'trip-1', name: 'Débora', nickname: 'Deb', isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
  ];

  const mkTx = (id: string, amountCents: number, description: string, date: string, payerId: string | null = 'julio'): Transaction => ({
    ...meta, id, tripId: 'trip-1', phaseId: 'ph-1',
    budgetPoolId: 'pool-1', walletId: null, sessionId: null,
    type: 'expense', amountCents, personalCostCents: null,
    currency: 'EUR', baseCurrencyAmountCents: amountCents, exchangeRate: null,
    category: 'bar', subcategoryId: 'bar_drink', placeLabel: null, latitude: null, longitude: null, placeId: null, description, date,
    isShared: true, paidByParticipantId: payerId,
    activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
    sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
  });

  const mkShare = (id: string, txId: string, participantId: string, amountCents: number, status: ParticipantShare['confirmationStatus'] = 'confirmed'): ParticipantShare => ({
    ...meta, id, transactionId: txId, participantId, shareAmountCents: amountCents, shareType: 'equal', isPaid: false, confirmationStatus: status, notes: null,
  });

  // The exact field report: "Débora deve €1,12 — de onde veio?"
  it('traces a €1.12 debt item by item', () => {
    const tx1 = mkTx('tx-1', 150, 'Cerveja', '2026-07-01T20:00:00.000Z');
    const tx2 = mkTx('tx-2', 74, 'Água', '2026-07-02T12:00:00.000Z');
    const shares = [
      mkShare('s1', 'tx-1', 'julio', 75),
      mkShare('s2', 'tx-1', 'debora', 75),
      mkShare('s3', 'tx-2', 'julio', 37),
      mkShare('s4', 'tx-2', 'debora', 37),
    ];
    const statement = buildParticipantStatement('debora', [tx1, tx2], shares, participants, [], 'julio');
    expect(statement.lines).toHaveLength(2);
    expect(statement.lines.every((l) => l.kind === 'owes')).toBe(true);
    // 75 + 37 = 112 cents = the €1.12 from the report, fully traceable.
    expect(statement.netCents).toBe(-112);
    expect(statement.lines[0]!.counterpartyName).toBe('Julio');
    expect(statement.lines[0]!.subcategoryId).toBe('bar_drink');
  });

  it('matches calculateDebts balance for the same inputs', () => {
    const tx1 = mkTx('tx-1', 6000, 'Mercado', '2026-07-01T00:00:00.000Z');
    const shares = [
      mkShare('s1', 'tx-1', 'julio', 3000),
      mkShare('s2', 'tx-1', 'debora', 3000),
    ];
    const debts = calculateDebts([tx1], shares, participants, [], 'julio');
    const balances = calculateParticipantBalances(debts.debts);
    const statement = buildParticipantStatement('debora', [tx1], shares, participants, [], 'julio');
    expect(statement.netCents).toBe(balances.get('debora'));
  });

  it('shows credit lines when the participant paid for others', () => {
    const tx = mkTx('tx-1', 4000, 'Jantar', '2026-07-03T00:00:00.000Z', 'debora');
    const shares = [
      mkShare('s1', 'tx-1', 'debora', 2000),
      mkShare('s2', 'tx-1', 'julio', 2000),
    ];
    const statement = buildParticipantStatement('debora', [tx], shares, participants, [], 'julio');
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0]!.kind).toBe('is_owed');
    expect(statement.lines[0]!.counterpartyId).toBe('julio');
    expect(statement.netCents).toBe(2000);
  });

  it('includes pending lines for context but excludes them from the net', () => {
    const tx = mkTx('tx-1', 2000, 'Bar', '2026-07-04T00:00:00.000Z');
    const shares = [
      mkShare('s1', 'tx-1', 'julio', 1000),
      mkShare('s2', 'tx-1', 'debora', 1000, 'pending'),
    ];
    const statement = buildParticipantStatement('debora', [tx], shares, participants, [], 'julio');
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0]!.confirmationStatus).toBe('pending');
    expect(statement.netCents).toBe(0);
  });

  it('excludes rejected shares entirely', () => {
    const tx = mkTx('tx-1', 2000, 'Bar', '2026-07-04T00:00:00.000Z');
    const shares = [mkShare('s1', 'tx-1', 'debora', 1000, 'rejected')];
    const statement = buildParticipantStatement('debora', [tx], shares, participants, [], 'julio');
    expect(statement.lines).toHaveLength(0);
    expect(statement.netCents).toBe(0);
  });

  it('applies settlements to the net and lists them', () => {
    const tx = mkTx('tx-1', 6000, 'Mercado', '2026-07-01T00:00:00.000Z');
    const shares = [
      mkShare('s1', 'tx-1', 'julio', 3000),
      mkShare('s2', 'tx-1', 'debora', 3000),
    ];
    const settlements = [
      { ...meta, id: 'set-1', tripId: 'trip-1', debtorParticipantId: 'debora', creditorParticipantId: 'julio', amountCents: 2000, currency: 'EUR', settledAt: '2026-07-02T00:00:00.000Z', linkedTransactionId: null, notes: null },
    ];
    const statement = buildParticipantStatement('debora', [tx], shares, participants, settlements, 'julio');
    expect(statement.settlements).toHaveLength(1);
    expect(statement.netCents).toBe(-1000);
  });

  it('sorts lines by date, newest first', () => {
    const tx1 = mkTx('tx-1', 1000, 'Antigo', '2026-07-01T00:00:00.000Z');
    const tx2 = mkTx('tx-2', 1000, 'Novo', '2026-07-05T00:00:00.000Z');
    const shares = [
      mkShare('s1', 'tx-1', 'debora', 500),
      mkShare('s2', 'tx-2', 'debora', 500),
    ];
    const statement = buildParticipantStatement('debora', [tx1, tx2], shares, participants, [], 'julio');
    expect(statement.lines[0]!.description).toBe('Novo');
    expect(statement.lines[1]!.description).toBe('Antigo');
  });
});
