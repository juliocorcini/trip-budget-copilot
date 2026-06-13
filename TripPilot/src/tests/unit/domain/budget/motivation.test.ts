import { describe, it, expect } from 'vitest';
import {
  projectTripEndSurplus,
  calculateSavingsGoalProgress,
  calculatePiggyBank,
  calculateFreeToSpend,
} from '@/domain/budget';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';

// E6 (M14/M15) — motivation layer. All money is integer cents.

describe('projectTripEndSurplus', () => {
  it('extrapolates the current pace over the remaining days', () => {
    // €400 spent in 4 days → €100/day; over 6 more days → €600 more → €1000
    // projected spend against a €1000 budget = €0 left.
    expect(
      projectTripEndSurplus({
        totalBudgetCents: 100000,
        totalSpentCents: 40000,
        daysElapsed: 4,
        daysRemaining: 6,
      }),
    ).toBe(0);
  });

  it('projects a positive surplus when spending below pace', () => {
    // €200 in 4 days → €50/day; +6 days → €300 → €500 projected spend → €500 left.
    expect(
      projectTripEndSurplus({
        totalBudgetCents: 100000,
        totalSpentCents: 20000,
        daysElapsed: 4,
        daysRemaining: 6,
      }),
    ).toBe(50000);
  });

  it('projects an overspend (negative) when the pace is too high', () => {
    // €600 in 3 days → €200/day; +3 days → €600 → €1200 projected vs €1000 → -€200.
    expect(
      projectTripEndSurplus({
        totalBudgetCents: 100000,
        totalSpentCents: 60000,
        daysElapsed: 3,
        daysRemaining: 3,
      }),
    ).toBe(-20000);
  });

  it('rounds the projected daily spend to whole cents', () => {
    // €100 in 3 days → 3333.33/day; +2 days → round(6666.66)=6667 → 16667 spend.
    expect(
      projectTripEndSurplus({
        totalBudgetCents: 100000,
        totalSpentCents: 10000,
        daysElapsed: 3,
        daysRemaining: 2,
      }),
    ).toBe(100000 - 16667);
  });

  it('guards against a zero elapsed-day divide', () => {
    expect(
      projectTripEndSurplus({
        totalBudgetCents: 100000,
        totalSpentCents: 0,
        daysElapsed: 0,
        daysRemaining: 5,
      }),
    ).toBe(100000);
  });
});

describe('calculateSavingsGoalProgress', () => {
  it('caps the ratio at 1 and reports being ahead of the goal', () => {
    const result = calculateSavingsGoalProgress({ goalCents: 20000, projectedSurplusCents: 50000 });
    expect(result.progressRatio).toBe(1);
    expect(result.gapCents).toBe(30000);
    expect(result.onTrack).toBe(true);
  });

  it('reports a partial ratio and a negative gap when behind', () => {
    const result = calculateSavingsGoalProgress({ goalCents: 20000, projectedSurplusCents: 10000 });
    expect(result.progressRatio).toBe(0.5);
    expect(result.gapCents).toBe(-10000);
    expect(result.onTrack).toBe(false);
  });

  it('floors the ratio at 0 when the projection is negative', () => {
    const result = calculateSavingsGoalProgress({ goalCents: 20000, projectedSurplusCents: -5000 });
    expect(result.progressRatio).toBe(0);
    expect(result.onTrack).toBe(false);
  });

  it('treats a non-positive goal as already met', () => {
    expect(calculateSavingsGoalProgress({ goalCents: 0, projectedSurplusCents: 0 }).progressRatio).toBe(1);
  });
});

describe('calculatePiggyBank', () => {
  it('is the cumulative under-spend versus the linear ideal', () => {
    // 4/10 of the trip → ideal €400; spent €200 → €200 saved.
    expect(
      calculatePiggyBank({
        totalBudgetCents: 100000,
        totalSpentCents: 20000,
        daysElapsed: 4,
        totalDays: 10,
      }),
    ).toBe(20000);
  });

  it('never goes negative when spending above the ideal pace', () => {
    expect(
      calculatePiggyBank({
        totalBudgetCents: 100000,
        totalSpentCents: 50000,
        daysElapsed: 4,
        totalDays: 10,
      }),
    ).toBe(0);
  });

  it('returns 0 before the trip has started or with no days', () => {
    expect(
      calculatePiggyBank({ totalBudgetCents: 100000, totalSpentCents: 0, daysElapsed: 0, totalDays: 10 }),
    ).toBe(0);
    expect(
      calculatePiggyBank({ totalBudgetCents: 100000, totalSpentCents: 0, daysElapsed: 4, totalDays: 0 }),
    ).toBe(0);
  });

  it('caps the elapsed fraction at the full trip length', () => {
    // daysElapsed > totalDays clamps to 1 → ideal = full budget.
    expect(
      calculatePiggyBank({
        totalBudgetCents: 100000,
        totalSpentCents: 30000,
        daysElapsed: 99,
        totalDays: 10,
      }),
    ).toBe(70000);
  });
});

// ÂNCORA 11 / DEC-088: the goal and the piggy bank are READ-ONLY. They are not
// inputs to calculateFreeToSpend, so the "free to spend" result is identical
// whether or not a goal exists — proven structurally here.
describe('motivation layer never touches free-to-spend', () => {
  const baseMeta = {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 1,
    sourceDeviceId: 'test-device',
  };

  const pool: BudgetPool = {
    ...baseMeta,
    id: 'pool-1',
    tripId: 'trip-1',
    name: 'Main Fund',
    scope: 'linked_phases',
    totalAmountCents: 100000,
    currency: 'EUR',
    notes: null,
  };

  const link: BudgetPoolPhaseLink = {
    ...baseMeta,
    id: 'link-1',
    budgetPoolId: 'pool-1',
    phaseId: 'phase-1',
    futureFloorCents: null,
  };

  const tx: Transaction = {
    ...baseMeta,
    id: 't1',
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents: 20000,
    personalCostCents: 20000,
    currency: 'EUR',
    baseCurrencyAmountCents: 20000,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: null,
    description: 'test',
    date: '2026-01-02T00:00:00.000Z',
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
  };

  const envelopes: Envelope[] = [];

  it('keeps freeToSpend identical regardless of any savings goal', () => {
    const free = calculateFreeToSpend(pool, envelopes, [tx], [link], 'phase-1', []);

    // The traveler sets, then doubles, then drops a goal — and computes the piggy.
    calculateSavingsGoalProgress({ goalCents: 20000, projectedSurplusCents: 30000 });
    calculateSavingsGoalProgress({ goalCents: 40000, projectedSurplusCents: 30000 });
    calculatePiggyBank({ totalBudgetCents: 100000, totalSpentCents: 20000, daysElapsed: 4, totalDays: 10 });

    const freeAfter = calculateFreeToSpend(pool, envelopes, [tx], [link], 'phase-1', []);
    expect(freeAfter).toEqual(free);
    // No protected reserve was created by the goal (it is not a real envelope).
    expect(freeAfter.protectedReserveCents).toBe(0);
    expect(freeAfter.freeToSpendCents).toBe(80000);
  });
});
