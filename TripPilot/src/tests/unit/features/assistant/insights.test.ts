import { describe, it, expect } from 'vitest';
import { computeExpenseInsights, type ExpenseInsightInput } from '@/features/assistant/assistant-insights';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-246: the AI preview's non-blocking "is this normal / can I afford it?"
 * hints. We compose tested domain math (typical, anomaly, free-to-spend); these
 * tests pin the wiring: anomaly threshold, after-balance subtraction, the `over`
 * flag, and the graceful nulls when the fund can't be resolved.
 */
const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const mkPool = (id: string, totalAmountCents: number): BudgetPool => ({
  ...meta,
  id,
  tripId: 'trip-1',
  name: id === 'pool-1' ? 'Geral' : id,
  scope: 'linked_phases',
  totalAmountCents,
  currency: 'EUR',
  notes: null,
});

const mkTx = (id: string, amountCents: number, category: string): Transaction => ({
  ...meta,
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: null,
  sessionId: null,
  type: 'expense',
  amountCents,
  personalCostCents: amountCents,
  currency: 'EUR',
  baseCurrencyAmountCents: amountCents,
  exchangeRate: null,
  category,
  subcategoryId: null,
  placeLabel: null,
  latitude: null,
  longitude: null,
  placeId: null,
  description: 'x',
  date: '2026-01-01T00:00:00.000Z',
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
});

const link: BudgetPoolPhaseLink = {
  ...meta,
  id: 'l1',
  budgetPoolId: 'pool-1',
  phaseId: 'phase-1',
  futureFloorCents: null,
};

// Three €10 bar expenses → a typical of 1000 cents (≥ MIN_TYPICAL_SAMPLES).
const barHistory = [mkTx('h1', 1000, 'bar'), mkTx('h2', 1000, 'bar'), mkTx('h3', 1000, 'bar')];

function mkInput(overrides: Partial<ExpenseInsightInput>): ExpenseInsightInput {
  return {
    amountBaseCents: 1200,
    category: 'bar',
    budgetPoolId: 'pool-1',
    currentPhaseId: 'phase-1',
    transactions: barHistory,
    pools: [mkPool('pool-1', 50000)],
    envelopes: [],
    links: [link],
    occurrences: [],
    plannedPurchases: [],
    ...overrides,
  };
}

describe('computeExpenseInsights', () => {
  it('flags an amount far above the category typical (3× the ~€10 typical)', () => {
    const out = computeExpenseInsights(mkInput({ amountBaseCents: 5000 }));
    expect(out.typicalCents).toBe(1000);
    expect(out.anomaly).toBe(true);
  });

  it('does not flag a normal amount near the typical', () => {
    const out = computeExpenseInsights(mkInput({ amountBaseCents: 1200 }));
    expect(out.anomaly).toBe(false);
  });

  it('needs enough history before judging an anomaly (under 3 samples → no typical)', () => {
    const out = computeExpenseInsights(
      mkInput({ amountBaseCents: 9000, transactions: barHistory.slice(0, 2) }),
    );
    expect(out.typicalCents).toBe(0);
    expect(out.anomaly).toBe(false);
  });

  it('computes free-to-spend left in the fund AFTER the expense', () => {
    // total 50000 − spent 3000 (history) = 47000 free; after a 1200 expense → 45800.
    const out = computeExpenseInsights(mkInput({ amountBaseCents: 1200 }));
    expect(out.afterCents).toBe(45800);
    expect(out.over).toBe(false);
    expect(out.poolName).toBe('Geral');
  });

  it('marks the expense as over budget when it pushes the fund below zero', () => {
    // total 4000 − spent 3000 = 1000 free; a 1500 expense → after −500 → over.
    const out = computeExpenseInsights(
      mkInput({ amountBaseCents: 1500, pools: [mkPool('pool-1', 4000)] }),
    );
    expect(out.afterCents).toBe(-500);
    expect(out.over).toBe(true);
  });

  it('degrades gracefully when the fund cannot be resolved (still judges anomaly)', () => {
    const out = computeExpenseInsights(mkInput({ amountBaseCents: 5000, budgetPoolId: 'missing' }));
    expect(out.afterCents).toBeNull();
    expect(out.over).toBe(false);
    expect(out.poolName).toBeNull();
    expect(out.anomaly).toBe(true);
  });
});
