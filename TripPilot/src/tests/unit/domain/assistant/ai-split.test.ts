import { describe, it, expect } from 'vitest';
import { resolvePayerExpense, calculateDebts } from '@/domain/splitting';
import type { Transaction } from '@/domain/types/transaction';
import type { Participant } from '@/domain/types/participant';
import type { ShareType } from '@/domain/types/common';

/**
 * DEC-424 (G10): the AI expense sheet can now split (who paid, equal/custom)
 * WITHOUT bouncing to the full form. The sheet writes only the op fields
 * (`shareType` / `customAmountsCents`); `dispatch.executeExpense` threads them
 * straight into the SAME `resolvePayerExpense` engine a manual entry uses.
 *
 * These tests pin that contract with concrete money: they call the engine with
 * the EXACT arguments dispatch now passes, so an AI-authored split must produce
 * the same shares, debts, and personal cost as a hand-entered one — and the
 * planner-emitted op (no split fields → defaults) must be untouched.
 */

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const julio: Participant = { ...meta, id: 'julio', tripId: 'trip-1', name: 'Julio', nickname: null, isOwner: true, email: null, linkedUserAccountId: null, linkedActorId: null };
const ana: Participant = { ...meta, id: 'ana', tripId: 'trip-1', name: 'Ana', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null };
const bia: Participant = { ...meta, id: 'bia', tripId: 'trip-1', name: 'Bia', nickname: null, isOwner: false, email: null, linkedUserAccountId: null, linkedActorId: null };
const participants: Participant[] = [julio, ana, bia];

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
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
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

/** Mirrors `dispatch.executeExpense`: it defaults an unset split to a plain equal one. */
function resolveFromOp(op: {
  amountCents: number;
  payerId: string;
  didSplit: boolean;
  participantIds: string[];
  shareType?: ShareType;
  customAmountsCents?: Record<string, number>;
}) {
  return resolvePayerExpense({
    transactionId: 'tx-1',
    amountCents: op.amountCents,
    ownerId: 'julio',
    payerId: op.payerId,
    didSplit: op.didSplit,
    participantIds: op.participantIds,
    shareType: op.shareType ?? 'equal',
    customAmountsCents: op.customAmountsCents ?? {},
  });
}

describe('DEC-424 — AI split threads through the payer engine', () => {
  it('a planner op with NO split fields still resolves to a plain "all mine" expense', () => {
    // The planner emits {didSplit:false} and never sets shareType/customAmountsCents.
    const r = resolveFromOp({ amountCents: 3000, payerId: 'julio', didSplit: false, participantIds: [] });
    expect(r.personalCostCents).toBe(3000);
    expect(r.shares).toHaveLength(0);
    expect(r.isShared).toBe(false);
  });

  it('an equal split from the sheet divides evenly (€30 owner+Ana → 15 each)', () => {
    const r = resolveFromOp({
      amountCents: 3000,
      payerId: 'julio',
      didSplit: true,
      participantIds: ['julio', 'ana'],
      shareType: 'equal',
    });
    expect(r.personalCostCents).toBe(1500);
    const tx = mkTx({ isShared: true, paidByParticipantId: 'julio', personalCostCents: 1500, amountCents: 3000 });
    const debts = calculateDebts([tx], r.shares, participants, [], 'julio');
    expect(debts.debts).toEqual([
      expect.objectContaining({ debtorId: 'ana', creditorId: 'julio', amountCents: 1500 }),
    ]);
  });

  it('a CUSTOM split honors the typed amount and drops the remainder on the payer', () => {
    // €30 total, I typed only Ana=€10 → my (payer) share absorbs the €20 remainder.
    const r = resolveFromOp({
      amountCents: 3000,
      payerId: 'julio',
      didSplit: true,
      participantIds: ['julio', 'ana'],
      shareType: 'custom',
      customAmountsCents: { ana: 1000 },
    });
    expect(r.personalCostCents).toBe(2000);
    const anaShare = r.shares.find((s) => s.participantId === 'ana')!;
    expect(anaShare.shareAmountCents).toBe(1000);
    // Money invariance: the shares always re-sum to the full amount.
    const total = r.shares.reduce((sum, s) => sum + s.shareAmountCents, 0);
    expect(total).toBe(3000);

    const tx = mkTx({ isShared: true, paidByParticipantId: 'julio', personalCostCents: 2000, amountCents: 3000 });
    const debts = calculateDebts([tx], r.shares, participants, [], 'julio');
    expect(debts.debts).toEqual([
      expect.objectContaining({ debtorId: 'ana', creditorId: 'julio', amountCents: 1000 }),
    ]);
  });

  it('a CUSTOM three-way split where Ana paid: remainder lands on Ana, I owe my typed share', () => {
    // €50, Ana paid. Typed: me=€20, Bia=€5 → Ana (payer) absorbs the €25 remainder.
    const r = resolveFromOp({
      amountCents: 5000,
      payerId: 'ana',
      didSplit: true,
      participantIds: ['julio', 'ana', 'bia'],
      shareType: 'custom',
      customAmountsCents: { julio: 2000, bia: 500 },
    });
    // My personal cost is exactly what I typed.
    expect(r.personalCostCents).toBe(2000);
    const total = r.shares.reduce((sum, s) => sum + s.shareAmountCents, 0);
    expect(total).toBe(5000);
    const anaShare = r.shares.find((s) => s.participantId === 'ana')!;
    expect(anaShare.shareAmountCents).toBe(2500);

    const tx = mkTx({ isShared: true, paidByParticipantId: 'ana', personalCostCents: 2000, amountCents: 5000 });
    const debts = calculateDebts([tx], r.shares, participants, [], 'julio');
    // I owe Ana my €20 share; Bia owes Ana €5.
    expect(debts.debts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ debtorId: 'julio', creditorId: 'ana', amountCents: 2000 }),
        expect.objectContaining({ debtorId: 'bia', creditorId: 'ana', amountCents: 500 }),
      ]),
    );
  });
});
