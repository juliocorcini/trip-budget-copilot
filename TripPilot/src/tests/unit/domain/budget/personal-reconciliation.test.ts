import { describe, it, expect } from 'vitest';
import { buildPersonalReconciliation } from '@/domain/budget/personal-reconciliation';
import { calculatePoolSpent } from '@/domain/budget';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-466 (INV-1) — the "conta do Julio": personal cost must be rebuildable
 * from the bank-statement view (outflow − fronted + share fronted by others),
 * and must equal `calculatePoolSpent` for the same rows so the hero's
 * "Já gasto" line and the reconciliation card can never disagree.
 */

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    ...meta,
    id: `tx-${Math.random()}`,
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents: 1000,
    personalCostCents: null,
    currency: 'EUR',
    baseCurrencyAmountCents: 1000,
    exchangeRate: null,
    category: 'food',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'test',
    date: '2026-06-01T12:00:00.000Z',
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
  } as Transaction;
}

const ME = 'p-me';
const BRUNO = 'p-bruno';

describe('buildPersonalReconciliation (DEC-466)', () => {
  it('a solo expense is pure outflow AND pure personal cost', () => {
    const recon = buildPersonalReconciliation([makeTx({ amountCents: 4_200 })], ME);
    expect(recon).toEqual({
      walletOutflowCents: 4_200,
      paidForOthersCents: 0,
      sharePaidByOthersCents: 0,
      personalCostCents: 4_200,
    });
  });

  it('fronting a split: full outflow, but only your share is personal cost', () => {
    // You paid 100, your share is 40 → 60 fronted for others.
    const recon = buildPersonalReconciliation(
      [makeTx({ amountCents: 10_000, personalCostCents: 4_000, isShared: true })],
      ME,
    );
    expect(recon.walletOutflowCents).toBe(10_000);
    expect(recon.paidForOthersCents).toBe(6_000);
    expect(recon.personalCostCents).toBe(4_000);
  });

  it("a friend fronting for you: zero outflow, your share still counts", () => {
    const recon = buildPersonalReconciliation(
      [makeTx({ amountCents: 10_000, personalCostCents: 3_000, paidByParticipantId: BRUNO, isShared: true })],
      ME,
    );
    expect(recon.walletOutflowCents).toBe(0);
    expect(recon.sharePaidByOthersCents).toBe(3_000);
    expect(recon.personalCostCents).toBe(3_000);
  });

  it("Julio's phase story: 310 out − 30 fronted + 82 owed = 362 personal", () => {
    const txs = [
      // €280 of things that are purely his, paid by him.
      makeTx({ amountCents: 28_000 }),
      // €30 he fronted entirely for Bruno (his share = 0).
      makeTx({ amountCents: 3_000, personalCostCents: 0, isShared: true }),
      // €82 = his share of things Bruno fronted.
      makeTx({ amountCents: 16_400, personalCostCents: 8_200, paidByParticipantId: BRUNO, isShared: true }),
    ];
    const recon = buildPersonalReconciliation(txs, ME);
    expect(recon.walletOutflowCents).toBe(31_000); // 280 + 30 out of his account
    expect(recon.paidForOthersCents).toBe(3_000);
    expect(recon.sharePaidByOthersCents).toBe(8_200);
    expect(recon.personalCostCents).toBe(36_200); // 310 − 30 + 82
    // Identity: outflow − fronted + owed-share == personal cost.
    expect(
      recon.walletOutflowCents - recon.paidForOthersCents + recon.sharePaidByOthersCents,
    ).toBe(recon.personalCostCents);
  });

  it('CRITICAL: personalCostCents === calculatePoolSpent for the same rows', () => {
    const txs = [
      makeTx({ amountCents: 28_000 }),
      makeTx({ amountCents: 3_000, personalCostCents: 0, isShared: true }),
      makeTx({ amountCents: 16_400, personalCostCents: 8_200, paidByParticipantId: BRUNO, isShared: true }),
      makeTx({ type: 'adjustment', amountCents: 500 }),
      // Foreign-currency row: personal share converts at the tx rate.
      makeTx({ amountCents: 1_000, exchangeRate: 6, baseCurrencyAmountCents: 6_000 }),
    ];
    const recon = buildPersonalReconciliation(txs, ME);
    expect(recon.personalCostCents).toBe(calculatePoolSpent(txs));
  });

  it('ignores income and deleted rows (mirrors the pool-spent filter)', () => {
    const txs = [
      makeTx({ amountCents: 5_000 }),
      makeTx({ type: 'income', amountCents: 9_999 }),
      makeTx({ deletedAt: '2026-06-05T00:00:00.000Z', amountCents: 7_777 }),
    ];
    const recon = buildPersonalReconciliation(txs, ME);
    expect(recon.walletOutflowCents).toBe(5_000);
    expect(recon.personalCostCents).toBe(5_000);
  });

  it('explicit self payer id counts as "paid by me" (same as null)', () => {
    const recon = buildPersonalReconciliation(
      [makeTx({ amountCents: 8_000, personalCostCents: 5_000, paidByParticipantId: ME, isShared: true })],
      ME,
    );
    expect(recon.walletOutflowCents).toBe(8_000);
    expect(recon.paidForOthersCents).toBe(3_000);
  });
});
