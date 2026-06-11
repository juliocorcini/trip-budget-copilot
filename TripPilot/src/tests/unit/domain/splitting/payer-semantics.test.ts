import { describe, it, expect } from 'vitest';
import {
  resolvePayerExpense,
  isPaidByOwner,
  calculateDebts,
  calculateOwnerPersonalCost,
} from '@/domain/splitting';
import { calculateSessionTotal, calculateReportedTotalDiff } from '@/domain/outing';
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

const participants: Participant[] = [
  { ...meta, id: 'julio', tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null },
  { ...meta, id: 'ana', tripId: 'trip-1', name: 'Ana', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null },
];

function mkTx(overrides: Partial<Transaction>): Transaction {
  return {
    ...meta,
    id: 'tx-1',
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents: 1000,
    personalCostCents: 1000,
    currency: 'EUR',
    baseCurrencyAmountCents: 1000,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: null,
    description: 'Drinks',
    date: '2026-07-01T20:00:00.000Z',
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
    ...overrides,
  };
}

/* DEC-114 (R-04): the payer truth table — one line per scenario. */
describe('resolvePayerExpense — truth table', () => {
  it('row 1: I paid, not split → full personal cost, no shares, wallet debited', () => {
    const result = resolvePayerExpense({
      transactionId: 'tx-1',
      amountCents: 1500,
      ownerId: 'julio',
      payerId: 'julio',
      didSplit: false,
      participantIds: [],
      shareType: 'equal',
      customAmountsCents: {},
    });
    expect(result.personalCostCents).toBe(1500);
    expect(result.shares).toHaveLength(0);
    expect(result.movesOwnerWallet).toBe(true);
    expect(result.isShared).toBe(false);
  });

  it('row 2: I paid €10 split 50/50 → my cost 5, Ana owes me 5, wallet debited', () => {
    const result = resolvePayerExpense({
      transactionId: 'tx-1',
      amountCents: 1000,
      ownerId: 'julio',
      payerId: 'julio',
      didSplit: true,
      participantIds: ['julio', 'ana'],
      shareType: 'equal',
      customAmountsCents: {},
    });
    expect(result.personalCostCents).toBe(500);
    expect(result.movesOwnerWallet).toBe(true);
    expect(result.isShared).toBe(true);

    const tx = mkTx({ isShared: true, paidByParticipantId: 'julio', personalCostCents: 500 });
    // Field scenario (c): Ana confirms her share → she owes me 5.
    const confirmed = result.shares.map((s) => ({ ...s, confirmationStatus: 'confirmed' as const }));
    const debts = calculateDebts([tx], confirmed, participants, [], 'julio');
    expect(debts.debts).toEqual([
      expect.objectContaining({ debtorId: 'ana', creditorId: 'julio', amountCents: 500 }),
    ]);
  });

  it('row 3: Ana paid €10 split 50/50 → my cost 5, I owe Ana 5, wallet untouched', () => {
    const result = resolvePayerExpense({
      transactionId: 'tx-1',
      amountCents: 1000,
      ownerId: 'julio',
      payerId: 'ana',
      didSplit: true,
      participantIds: ['julio', 'ana'],
      shareType: 'equal',
      customAmountsCents: {},
    });
    expect(result.personalCostCents).toBe(500);
    expect(result.movesOwnerWallet).toBe(false);
    expect(result.isShared).toBe(true);

    // My own share is born confirmed — the debt exists immediately.
    const myShare = result.shares.find((s) => s.participantId === 'julio')!;
    expect(myShare.confirmationStatus).toBe('confirmed');

    const tx = mkTx({ isShared: true, paidByParticipantId: 'ana', personalCostCents: 500 });
    const debts = calculateDebts([tx], result.shares, participants, [], 'julio');
    expect(debts.debts).toEqual([
      expect.objectContaining({ debtorId: 'julio', creditorId: 'ana', amountCents: 500 }),
    ]);
  });

  it('row 4 (the field bug): Ana paid €15, NOT split → my cost is 15 AND I owe Ana 15', () => {
    const result = resolvePayerExpense({
      transactionId: 'tx-1',
      amountCents: 1500,
      ownerId: 'julio',
      payerId: 'ana',
      didSplit: false,
      participantIds: [],
      shareType: 'equal',
      customAmountsCents: {},
    });
    // NEVER a gift: the cost stays mine in full.
    expect(result.personalCostCents).toBe(1500);
    expect(result.movesOwnerWallet).toBe(false);
    expect(result.isShared).toBe(true);
    expect(result.shares).toHaveLength(1);
    expect(result.shares[0]!.participantId).toBe('julio');
    expect(result.shares[0]!.shareAmountCents).toBe(1500);
    expect(result.shares[0]!.confirmationStatus).toBe('confirmed');

    const tx = mkTx({ isShared: true, paidByParticipantId: 'ana', personalCostCents: 1500, amountCents: 1500 });
    const debts = calculateDebts([tx], result.shares, participants, [], 'julio');
    expect(debts.debts).toEqual([
      expect.objectContaining({ debtorId: 'julio', creditorId: 'ana', amountCents: 1500 }),
    ]);
    // calculateOwnerPersonalCost agrees with the resolution (edit flows reuse it).
    expect(calculateOwnerPersonalCost(tx, result.shares, 'julio')).toBe(1500);
  });
});

describe('payer semantics in the session (field scenario)', () => {
  it('session at €20 + €15 paid by Ana not split → total goes to €35, not back to €20', () => {
    const own = mkTx({ id: 'tx-own', amountCents: 2000, personalCostCents: 2000, sessionId: 's1' });
    const resolution = resolvePayerExpense({
      transactionId: 'tx-ana',
      amountCents: 1500,
      ownerId: 'julio',
      payerId: 'ana',
      didSplit: false,
      participantIds: [],
      shareType: 'equal',
      customAmountsCents: {},
    });
    const anaPaid = mkTx({
      id: 'tx-ana',
      amountCents: 1500,
      personalCostCents: resolution.personalCostCents,
      isShared: true,
      paidByParticipantId: 'ana',
      sessionId: 's1',
    });
    expect(calculateSessionTotal([own, anaPaid])).toBe(3500);
  });

  it('R-05: reconciliation diff is computed over PERSONAL cost and keeps debts intact', () => {
    // Composite session: own item + split item + item paid by Ana in full.
    const own = mkTx({ id: 'tx-own', amountCents: 2000, personalCostCents: 2000, sessionId: 's1' });

    const split = resolvePayerExpense({
      transactionId: 'tx-split',
      amountCents: 1000,
      ownerId: 'julio',
      payerId: 'ana',
      didSplit: true,
      participantIds: ['julio', 'ana'],
      shareType: 'equal',
      customAmountsCents: {},
    });
    const splitTx = mkTx({
      id: 'tx-split',
      amountCents: 1000,
      personalCostCents: split.personalCostCents,
      isShared: true,
      paidByParticipantId: 'ana',
      sessionId: 's1',
    });

    const full = resolvePayerExpense({
      transactionId: 'tx-full',
      amountCents: 1500,
      ownerId: 'julio',
      payerId: 'ana',
      didSplit: false,
      participantIds: [],
      shareType: 'equal',
      customAmountsCents: {},
    });
    const fullTx = mkTx({
      id: 'tx-full',
      amountCents: 1500,
      personalCostCents: full.personalCostCents,
      isShared: true,
      paidByParticipantId: 'ana',
      sessionId: 's1',
    });

    // Personal total = 20 + 5 + 15 = 40 (NOT the financial flow of 45).
    const personalTotal = calculateSessionTotal([own, splitTx, fullTx]);
    expect(personalTotal).toBe(4000);

    // Reported €50 → adjustment of exactly €10 over the personal total.
    const diff = calculateReportedTotalDiff(5000, personalTotal);
    expect(diff.diffCents).toBe(1000);
    expect(diff.needsAdjustment).toBe(true);

    // The adjustment never touches shares: debts before == after (5 + 15 to Ana).
    const allShares: ParticipantShare[] = [...split.shares, ...full.shares];
    const adjustment = mkTx({ id: 'tx-adj', amountCents: 1000, personalCostCents: 1000, sessionId: 's1' });
    const debtsAfter = calculateDebts(
      [own, splitTx, fullTx, adjustment],
      allShares,
      participants,
      [],
      'julio',
    );
    expect(debtsAfter.debts).toEqual([
      expect.objectContaining({ debtorId: 'julio', creditorId: 'ana', amountCents: 2000 }),
    ]);
  });
});

describe('isPaidByOwner', () => {
  it('true when paidByParticipantId is null or the owner', () => {
    expect(isPaidByOwner(mkTx({ paidByParticipantId: null }), 'julio')).toBe(true);
    expect(isPaidByOwner(mkTx({ paidByParticipantId: 'julio' }), 'julio')).toBe(true);
  });

  it('false when someone else paid (even with unknown owner)', () => {
    expect(isPaidByOwner(mkTx({ paidByParticipantId: 'ana' }), 'julio')).toBe(false);
    expect(isPaidByOwner(mkTx({ paidByParticipantId: 'ana' }), null)).toBe(false);
  });
});
