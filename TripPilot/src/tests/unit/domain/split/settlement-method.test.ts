import { describe, it, expect } from 'vitest';
import { createSettlement, calculateDebts } from '@/domain/splitting';
import {
  SETTLEMENT_METHOD_KINDS,
  PAYMENT_METHOD_KINDS,
  type SettlementMethod,
} from '@/domain/payment/payment-methods';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';

/**
 * FB-27 (DEC-277) — "I got paid back". The owner pays the whole bill; others
 * repay via Pix/Wise/cash/transfer. We record that with the EXISTING Settlement
 * (debtor = who paid me, creditor = me) plus an OPTIONAL structured `method`.
 * These tests pin the four ACs: register total/partial, reduce the owed balance,
 * keep the method on the record, and never disturb the Wise-import dedupe key.
 */

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

// A €60 shared expense the owner paid, split 50/50 → Ana owes Julio €30.
const sharedExpense: Transaction = {
  ...meta,
  id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1', walletId: null, sessionId: null,
  type: 'expense', amountCents: 6000, personalCostCents: null, currency: 'EUR', baseCurrencyAmountCents: 6000, exchangeRate: null,
  category: 'market', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'Mercado', date: '2026-07-01T00:00:00.000Z',
  isShared: true, paidByParticipantId: null,
  activityProfileId: null, isSpecialOccasion: false, excludeFromLearning: false,
  sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null,
};

const shares: ParticipantShare[] = [
  { ...meta, id: 's1', transactionId: 'tx-1', participantId: 'julio', shareAmountCents: 3000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
  { ...meta, id: 's2', transactionId: 'tx-1', participantId: 'ana', shareAmountCents: 3000, shareType: 'equal', isPaid: false, confirmationStatus: 'confirmed', notes: null },
];

describe('createSettlement — structured method (FB-27 / DEC-277)', () => {
  it('defaults method to null and never sets externalRef (Wise dedupe untouched)', () => {
    const s = createSettlement('trip-1', 'ana', 'julio', 3000, 'EUR');
    expect(s.method).toBeNull();
    expect(s.externalRef).toBeUndefined();
    expect(s.debtorParticipantId).toBe('ana');
    expect(s.creditorParticipantId).toBe('julio');
    expect(s.amountCents).toBe(3000);
  });

  it('records the chosen method verbatim on the settlement', () => {
    const s = createSettlement('trip-1', 'ana', 'julio', 3000, 'EUR', 'pix');
    expect(s.method).toBe('pix');
    // the method is metadata only — it must not leak into the import dedupe key.
    expect(s.externalRef).toBeUndefined();
  });

  it('accepts every supported method kind', () => {
    for (const kind of SETTLEMENT_METHOD_KINDS) {
      const s = createSettlement('trip-1', 'ana', 'julio', 1000, 'EUR', kind);
      expect(s.method).toBe(kind);
    }
  });
});

describe('settlement reduces the owed balance (AC2/AC4)', () => {
  it('baseline: with no settlement Ana owes Julio the full €30', () => {
    const result = calculateDebts([sharedExpense], shares, participants, [], 'julio');
    expect(result.debts).toHaveLength(1);
    expect(result.debts[0]!.debtorId).toBe('ana');
    expect(result.debts[0]!.creditorId).toBe('julio');
    expect(result.debts[0]!.amountCents).toBe(3000);
  });

  it('AC4 partial: a €20 Pix repayment leaves Ana owing €10', () => {
    const partial = createSettlement('trip-1', 'ana', 'julio', 2000, 'EUR', 'pix');
    const result = calculateDebts([sharedExpense], shares, participants, [partial], 'julio');
    expect(result.debts).toHaveLength(1);
    expect(result.debts[0]!.amountCents).toBe(1000);
  });

  it('AC2 total: a €30 cash repayment clears the debt entirely', () => {
    const full = createSettlement('trip-1', 'ana', 'julio', 3000, 'EUR', 'cash');
    const result = calculateDebts([sharedExpense], shares, participants, [full], 'julio');
    expect(result.debts).toHaveLength(0);
    expect(result.totalDebtCents).toBe(0);
  });
});

describe('SETTLEMENT_METHOD_KINDS (FB-27)', () => {
  it('offers exactly pix/wise/bank/cash/other, in that order', () => {
    expect(SETTLEMENT_METHOD_KINDS).toEqual(['pix', 'wise', 'bank', 'cash', 'other']);
  });

  it('cash is settle-only — it never enters the "how to pay me" editor (DEC-244)', () => {
    expect((PAYMENT_METHOD_KINDS as readonly SettlementMethod[]).includes('cash')).toBe(false);
  });
});
