import { describe, it, expect } from 'vitest';
import {
  updateProfileFromTransaction,
  simulateSpend,
  calculateScenarioCost,
  calculateOccasionForecasts,
} from '@/domain/forecasting';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { ScenarioAllocationItem } from '@/domain/types/scenario';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const baseProfile: ActivityProfile = {
  ...meta, id: 'prof-1', tripId: 'trip-1',
  name: 'Bar', category: 'bar', iconName: null, color: null,
  typicalValueCents: 1500, safeValueCents: 2000,
  confidence: 'medium', dataPointCount: 5,
  expectedFrequencyPerPhase: 5, isCustom: false,
  defaultTargetCents: null, defaultCeilingCents: null,
  defaultMaxCents: null, defaultAvgDrinkPriceCents: null,
  quickAddValuesCents: null, notes: null,
};

describe('updateProfileFromTransaction', () => {
  it('updates weighted average', () => {
    const result = updateProfileFromTransaction(baseProfile, 2000, false);
    expect(result.dataPointCount).toBe(6);
    expect(result.typicalValueCents).toBeGreaterThan(1500);
    expect(result.typicalValueCents).toBeLessThan(2000);
  });

  it('does not update on special occasion', () => {
    const result = updateProfileFromTransaction(baseProfile, 5000, true);
    expect(result.typicalValueCents).toBe(1500);
    expect(result.dataPointCount).toBe(5);
  });

  it('confidence becomes high at 10 data points', () => {
    const profile = { ...baseProfile, dataPointCount: 9 };
    const result = updateProfileFromTransaction(profile, 1500, false);
    expect(result.confidence).toBe('high');
  });
});

describe('simulateSpend', () => {
  it('returns low risk for small spend', () => {
    const result = simulateSpend(100000, 10000);
    expect(result.risk).toBe('low');
    expect(result.canSpend).toBe(true);
    expect(result.freeAfterCents).toBe(90000);
  });

  it('returns critical when exceeding budget', () => {
    const result = simulateSpend(5000, 8000);
    expect(result.risk).toBe('critical');
    expect(result.canSpend).toBe(false);
    expect(result.freeAfterCents).toBe(-3000);
  });

  it('returns high risk for large portion', () => {
    const result = simulateSpend(10000, 6000);
    expect(result.risk).toBe('high');
    expect(result.canSpend).toBe(true);
  });

  it('returns medium risk for moderate spend', () => {
    const result = simulateSpend(10000, 3000);
    expect(result.risk).toBe('medium');
  });
});

describe('calculateScenarioCost', () => {
  it('sums quantity * unit cost', () => {
    const items: ScenarioAllocationItem[] = [
      { ...meta, id: 'a1', scenarioPlanId: 'sp1', activityProfileId: 'p1', quantity: 4, estimatedUnitCostCents: 1500, isLocked: false, priority: 'planned', notes: null },
      { ...meta, id: 'a2', scenarioPlanId: 'sp1', activityProfileId: 'p2', quantity: 3, estimatedUnitCostCents: 2500, isLocked: false, priority: 'planned', notes: null },
    ];
    expect(calculateScenarioCost(items)).toBe(4 * 1500 + 3 * 2500);
  });
});

describe('calculateOccasionForecasts', () => {
  it('calculates remaining occasions', () => {
    const profiles = [baseProfile];
    const allocations: ScenarioAllocationItem[] = [
      { ...meta, id: 'a1', scenarioPlanId: 'sp1', activityProfileId: 'prof-1', quantity: 5, estimatedUnitCostCents: 1500, isLocked: false, priority: 'planned', notes: null },
    ];
    const txs = [
      { ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1', walletId: null, sessionId: null, type: 'expense' as const, amountCents: 1500, personalCostCents: 1500, currency: 'EUR', baseCurrencyAmountCents: 1500, exchangeRate: null, category: 'bar', description: 'test', date: '2026-07-01T00:00:00.000Z', isShared: false, paidByParticipantId: null, activityProfileId: 'prof-1', isSpecialOccasion: false, excludeFromLearning: false, sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null },
      { ...meta, id: 'tx-2', tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1', walletId: null, sessionId: null, type: 'expense' as const, amountCents: 1800, personalCostCents: 1800, currency: 'EUR', baseCurrencyAmountCents: 1800, exchangeRate: null, category: 'bar', description: 'test', date: '2026-07-02T00:00:00.000Z', isShared: false, paidByParticipantId: null, activityProfileId: 'prof-1', isSpecialOccasion: false, excludeFromLearning: false, sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null },
    ];
    const forecasts = calculateOccasionForecasts(profiles, allocations, txs, 'ph-1');
    expect(forecasts).toHaveLength(1);
    expect(forecasts[0]!.remaining).toBe(3);
    expect(forecasts[0]!.spent).toBe(2);
    expect(forecasts[0]!.estimatedRemainingCostCents).toBe(3 * 2000);
  });

  it('GAP-R2-006: ignores transactions from other phases', () => {
    const profiles = [baseProfile];
    const allocations: ScenarioAllocationItem[] = [
      { ...meta, id: 'a1', scenarioPlanId: 'sp1', activityProfileId: 'prof-1', quantity: 5, estimatedUnitCostCents: 1500, isLocked: false, priority: 'planned', notes: null },
    ];
    const txs = [
      { ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1', walletId: null, sessionId: null, type: 'expense' as const, amountCents: 1500, personalCostCents: 1500, currency: 'EUR', baseCurrencyAmountCents: 1500, exchangeRate: null, category: 'bar', description: 'test', date: '2026-07-01T00:00:00.000Z', isShared: false, paidByParticipantId: null, activityProfileId: 'prof-1', isSpecialOccasion: false, excludeFromLearning: false, sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null },
      { ...meta, id: 'tx-2', tripId: 'trip-1', phaseId: 'ph-OTHER', budgetPoolId: 'pool-1', walletId: null, sessionId: null, type: 'expense' as const, amountCents: 1800, personalCostCents: 1800, currency: 'EUR', baseCurrencyAmountCents: 1800, exchangeRate: null, category: 'bar', description: 'test', date: '2026-07-02T00:00:00.000Z', isShared: false, paidByParticipantId: null, activityProfileId: 'prof-1', isSpecialOccasion: false, excludeFromLearning: false, sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null },
    ];
    const forecasts = calculateOccasionForecasts(profiles, allocations, txs, 'ph-1');
    expect(forecasts[0]!.spent).toBe(1);
    expect(forecasts[0]!.remaining).toBe(4);
  });
});
