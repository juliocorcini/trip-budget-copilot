import { describe, it, expect } from 'vitest';
import {
  createEqualShares,
  createCustomShares,
  calculatePersonalCost,
  calculateDebts,
  createSettlement,
} from '@/domain/splitting';
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

describe('createSettlement', () => {
  it('creates settlement entity', () => {
    const s = createSettlement('trip-1', 'ana', 'julio', 3000, 'EUR');
    expect(s.debtorParticipantId).toBe('ana');
    expect(s.creditorParticipantId).toBe('julio');
    expect(s.amountCents).toBe(3000);
    expect(s.settledAt).toBeTruthy();
  });
});
