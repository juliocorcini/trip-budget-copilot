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
  findPendingSharedTransactions,
  suggestSimplifiedSettlements,
} from '@/domain/splitting';
import type { DebtEntry } from '@/domain/splitting';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';

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
      { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'owner', shareAmountCents: 2000, shareType: 'equal', isPaid: false, notes: null },
      { ...meta, id: 's2', transactionId: 'tx-1', participantId: 'friend', shareAmountCents: 2000, shareType: 'equal', isPaid: false, notes: null },
    ];
    expect(calculatePersonalCost(shares, 'owner')).toBe(2000);
  });

  it('returns 0 when owner not in shares', () => {
    const shares: ParticipantShare[] = [
      { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'other', shareAmountCents: 1000, shareType: 'equal', isPaid: false, notes: null },
    ];
    expect(calculatePersonalCost(shares, 'owner')).toBe(0);
  });
});

describe('calculateDebts', () => {
  const participants: Participant[] = [
    { ...meta, id: 'julio', tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null },
    { ...meta, id: 'ana', tripId: 'trip-1', name: 'Ana', nickname: null, isOwner: false, email: null, linkedUserAccountId: null },
  ];

  it('calculates debt when owner paid shared expense', () => {
    const tx: Transaction = {
      ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1',
      budgetPoolId: 'pool-1', walletId: null, sessionId: null,
      type: 'expense', amountCents: 6000, personalCostCents: 3000,
      currency: 'EUR', baseCurrencyAmountCents: 6000, exchangeRate: null,
      category: 'market', description: 'Mercadona', date: '2026-07-01T00:00:00.000Z',
      isShared: true, paidByParticipantId: null,
      activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
      sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
    };
    const shares: ParticipantShare[] = [
      { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'julio', shareAmountCents: 3000, shareType: 'equal', isPaid: false, notes: null },
      { ...meta, id: 's2', transactionId: 'tx-1', participantId: 'ana', shareAmountCents: 3000, shareType: 'equal', isPaid: false, notes: null },
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
      category: 'market', description: 'Test', date: '2026-07-01T00:00:00.000Z',
      isShared: true, paidByParticipantId: null,
      activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
      sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
    };
    const shares: ParticipantShare[] = [
      { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'julio', shareAmountCents: 3000, shareType: 'equal', isPaid: false, notes: null },
      { ...meta, id: 's2', transactionId: 'tx-1', participantId: 'ana', shareAmountCents: 3000, shareType: 'equal', isPaid: false, notes: null },
    ];
    const settlements = [
      { ...meta, id: 'set-1', tripId: 'trip-1', debtorParticipantId: 'ana', creditorParticipantId: 'julio', amountCents: 2000, currency: 'EUR', settledAt: '2026-07-02T00:00:00.000Z', linkedTransactionId: null, notes: null },
    ];
    const result = calculateDebts([tx], shares, participants, settlements, 'julio');
    expect(result.debts[0]!.amountCents).toBe(1000);
  });
});

describe('findPendingSharedTransactions (GAP-016, decision D-C)', () => {
  const participants: Participant[] = [
    { ...meta, id: 'julio', tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null },
    { ...meta, id: 'ana', tripId: 'trip-1', name: 'Ana', nickname: null, isOwner: false, email: null, linkedUserAccountId: null },
  ];

  const sharedTx: Transaction = {
    ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1',
    budgetPoolId: 'pool-1', walletId: null, sessionId: null,
    type: 'expense', amountCents: 6000, personalCostCents: 3000,
    currency: 'EUR', baseCurrencyAmountCents: 6000, exchangeRate: null,
    category: 'market', description: 'Mercadona', date: '2026-07-01T00:00:00.000Z',
    isShared: true, paidByParticipantId: 'julio',
    activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
    sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
  };

  const shares: ParticipantShare[] = [
    { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'julio', shareAmountCents: 3000, shareType: 'equal', isPaid: false, notes: null },
    { ...meta, id: 's2', transactionId: 'tx-1', participantId: 'ana', shareAmountCents: 3000, shareType: 'equal', isPaid: false, notes: null },
  ];

  it('marks a shared expense pending while the third-party share is unsettled', () => {
    const pending = findPendingSharedTransactions([sharedTx], shares, participants, [], 'julio');
    expect(pending.map((tx) => tx.id)).toEqual(['tx-1']);
  });

  it('removes the expense from pending once the debt is fully settled', () => {
    const settlements = [
      { ...meta, id: 'set-1', tripId: 'trip-1', debtorParticipantId: 'ana', creditorParticipantId: 'julio', amountCents: 3000, currency: 'EUR', settledAt: '2026-07-02T00:00:00.000Z', linkedTransactionId: null, notes: null },
    ];
    const pending = findPendingSharedTransactions([sharedTx], shares, participants, settlements, 'julio');
    expect(pending).toHaveLength(0);
  });

  it('keeps the expense pending while the settlement is only partial', () => {
    const settlements = [
      { ...meta, id: 'set-1', tripId: 'trip-1', debtorParticipantId: 'ana', creditorParticipantId: 'julio', amountCents: 1000, currency: 'EUR', settledAt: '2026-07-02T00:00:00.000Z', linkedTransactionId: null, notes: null },
    ];
    const pending = findPendingSharedTransactions([sharedTx], shares, participants, settlements, 'julio');
    expect(pending).toHaveLength(1);
  });

  it('ignores non-shared expenses', () => {
    const personalTx = { ...sharedTx, id: 'tx-2', isShared: false, paidByParticipantId: null };
    const pending = findPendingSharedTransactions([personalTx], [], participants, [], 'julio');
    expect(pending).toHaveLength(0);
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
