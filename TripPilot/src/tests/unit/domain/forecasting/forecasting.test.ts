import { describe, it, expect } from 'vitest';
import {
  updateProfileFromTransaction,
  simulateSpend,
  simulateSpendMultiMetric,
  calculateScenarioCost,
  calculateOccasionForecasts,
  countProfileOccasions,
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

  // PAR-003a (R6-22): the preset acts as a prior of 3 virtual data points.
  it('first real data point refines the preset estimate instead of replacing it', () => {
    const fresh = { ...baseProfile, typicalValueCents: 1500, dataPointCount: 0 };
    const result = updateProfileFromTransaction(fresh, 9000, false);
    // weight = 1/(1+3) → 1500 × 0.75 + 9000 × 0.25 = 3375
    expect(result.typicalValueCents).toBe(3375);
    expect(result.typicalValueCents).toBeGreaterThan(1500);
    expect(result.typicalValueCents).toBeLessThan(9000);
    expect(result.dataPointCount).toBe(1);
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

describe('simulateSpendMultiMetric (DEC-094 / R-12)', () => {
  it('Julio scenario: €20 is only 4% of total BUT 4 days of a €5/day allowance → risk', () => {
    const result = simulateSpendMultiMetric({
      amountCents: 2_000,
      freeToSpendCents: 54_500, // "sobra €525, 4% do disponível"
      todayAllowanceCents: 500,
      remainingOccasions: [],
    });
    expect(result.total.risk).toBe('low'); // perspective 1 alone says "fine"
    expect(result.allowanceDays).toBe(4); // perspective 2: 4 days of budget
    expect(result.verdict).toBe('risk'); // the worst perspective wins
  });

  it('plan perspective: €20 ≈ 2 bar nights of €9 (capped at remaining)', () => {
    const result = simulateSpendMultiMetric({
      amountCents: 2_000,
      freeToSpendCents: 100_000,
      todayAllowanceCents: 5_000,
      remainingOccasions: [
        { profileId: 'bar', profileName: 'Bar', remaining: 6, typicalValueCents: 900 },
        { profileId: 'museum', profileName: 'Museu', remaining: 1, typicalValueCents: 1_500 },
      ],
    });
    const bar = result.planImpacts.find((i) => i.profileId === 'bar')!;
    expect(bar.occasionsLost).toBe(2);
    const museum = result.planImpacts.find((i) => i.profileId === 'museum')!;
    expect(museum.occasionsLost).toBe(1);
    expect(result.verdict).toBe('risk'); // 3 occasions lost in total
  });

  it('small spend on every perspective → ok', () => {
    const result = simulateSpendMultiMetric({
      amountCents: 300,
      freeToSpendCents: 50_000,
      todayAllowanceCents: 500,
      remainingOccasions: [
        { profileId: 'bar', profileName: 'Bar', remaining: 6, typicalValueCents: 900 },
      ],
    });
    expect(result.allowanceDays).toBe(0.6);
    expect(result.planImpacts).toEqual([]);
    expect(result.verdict).toBe('ok');
  });

  it('without allowance data the day perspective stays neutral', () => {
    const result = simulateSpendMultiMetric({
      amountCents: 2_000,
      freeToSpendCents: 50_000,
      todayAllowanceCents: null,
      remainingOccasions: [],
    });
    expect(result.allowanceDays).toBeNull();
    expect(result.verdict).toBe('ok');
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
      { ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1', walletId: null, sessionId: null, type: 'expense' as const, amountCents: 1500, personalCostCents: 1500, currency: 'EUR', baseCurrencyAmountCents: 1500, exchangeRate: null, category: 'bar', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'test', date: '2026-07-01T00:00:00.000Z', isShared: false, paidByParticipantId: null, activityProfileId: 'prof-1', isSpecialOccasion: false, excludeFromLearning: false, sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null },
      { ...meta, id: 'tx-2', tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1', walletId: null, sessionId: null, type: 'expense' as const, amountCents: 1800, personalCostCents: 1800, currency: 'EUR', baseCurrencyAmountCents: 1800, exchangeRate: null, category: 'bar', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'test', date: '2026-07-02T00:00:00.000Z', isShared: false, paidByParticipantId: null, activityProfileId: 'prof-1', isSpecialOccasion: false, excludeFromLearning: false, sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null },
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
      { ...meta, id: 'tx-1', tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1', walletId: null, sessionId: null, type: 'expense' as const, amountCents: 1500, personalCostCents: 1500, currency: 'EUR', baseCurrencyAmountCents: 1500, exchangeRate: null, category: 'bar', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'test', date: '2026-07-01T00:00:00.000Z', isShared: false, paidByParticipantId: null, activityProfileId: 'prof-1', isSpecialOccasion: false, excludeFromLearning: false, sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null },
      { ...meta, id: 'tx-2', tripId: 'trip-1', phaseId: 'ph-OTHER', budgetPoolId: 'pool-1', walletId: null, sessionId: null, type: 'expense' as const, amountCents: 1800, personalCostCents: 1800, currency: 'EUR', baseCurrencyAmountCents: 1800, exchangeRate: null, category: 'bar', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'test', date: '2026-07-02T00:00:00.000Z', isShared: false, paidByParticipantId: null, activityProfileId: 'prof-1', isSpecialOccasion: false, excludeFromLearning: false, sourceWalletId: null, targetWalletId: null, settlementId: null, adjustmentReason: null, notes: null },
    ];
    const forecasts = calculateOccasionForecasts(profiles, allocations, txs, 'ph-1');
    expect(forecasts[0]!.spent).toBe(1);
    expect(forecasts[0]!.remaining).toBe(4);
  });

  // DEC-115 (R-06) — the field scenario: 3 bar outings (9+8+3 items) + 2
  // standalone bar expenses = 5 occasions, NEVER 22.
  it('counts sessions as single occasions (field scenario 9+8+3 items + 2 standalone)', () => {
    const mkTx = (id: string, sessionId: string | null) => ({
      ...meta,
      id,
      tripId: 'trip-1',
      phaseId: 'ph-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      sessionId,
      type: 'expense' as const,
      amountCents: 500,
      personalCostCents: 500,
      currency: 'EUR',
      baseCurrencyAmountCents: 500,
      exchangeRate: null,
      category: 'bar',
      subcategoryId: null,
      placeLabel: null,
      latitude: null,
      longitude: null,
      placeId: null,
      description: 'test',
      date: '2026-07-01T00:00:00.000Z',
      isShared: false,
      paidByParticipantId: null,
      activityProfileId: 'prof-1',
      isSpecialOccasion: false,
      excludeFromLearning: false,
      sourceWalletId: null,
      targetWalletId: null,
      settlementId: null,
      adjustmentReason: null,
      notes: null,
    });

    const txs = [
      ...Array.from({ length: 9 }, (_, i) => mkTx(`s1-${i}`, 'session-1')),
      ...Array.from({ length: 8 }, (_, i) => mkTx(`s2-${i}`, 'session-2')),
      ...Array.from({ length: 3 }, (_, i) => mkTx(`s3-${i}`, 'session-3')),
      mkTx('standalone-1', null),
      mkTx('standalone-2', null),
    ];

    expect(countProfileOccasions(txs, 'prof-1', 'ph-1')).toBe(5);

    const allocations: ScenarioAllocationItem[] = [
      { ...meta, id: 'a1', scenarioPlanId: 'sp1', activityProfileId: 'prof-1', quantity: 5, estimatedUnitCostCents: 1500, isLocked: false, priority: 'planned', notes: null },
    ];
    const forecasts = calculateOccasionForecasts([baseProfile], allocations, txs, 'ph-1');
    expect(forecasts[0]!.spent).toBe(5);
    expect(forecasts[0]!.remaining).toBe(0);
  });
});

// DEC-463 (INV-4) — "planejar a partir de agora": occasions BEFORE countFromIso
// do not consume the plan. Julio's case: 15 bar nights already logged, then he
// plans 4 MORE — the card must read "4 restantes", not vanish at "15 de 4".
describe('calculateOccasionForecasts — countFromIso (DEC-463)', () => {
  const mkBarTx = (id: string, dateIso: string) => ({
    ...meta,
    id,
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense' as const,
    amountCents: 1500,
    personalCostCents: 1500,
    currency: 'EUR',
    baseCurrencyAmountCents: 1500,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'test',
    date: `${dateIso}T20:00:00.000Z`,
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: 'prof-1',
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
  });
  const allocations: ScenarioAllocationItem[] = [
    { ...meta, id: 'a1', scenarioPlanId: 'sp1', activityProfileId: 'prof-1', quantity: 4, estimatedUnitCostCents: 1500, isLocked: false, priority: 'planned', notes: null },
  ];

  it('occasions before the cut date do not consume the plan', () => {
    const txs = [
      mkBarTx('old-1', '2026-06-20'),
      mkBarTx('old-2', '2026-06-25'),
      mkBarTx('old-3', '2026-07-01'),
      mkBarTx('new-1', '2026-07-04'),
    ];
    const forecasts = calculateOccasionForecasts([baseProfile], allocations, txs, 'ph-1', '2026-07-04');
    expect(forecasts[0]!.spent).toBe(1);
    expect(forecasts[0]!.remaining).toBe(3);
  });

  it('countProfileOccasions honors sinceIso (inclusive on the cut day)', () => {
    const txs = [mkBarTx('a', '2026-07-03'), mkBarTx('b', '2026-07-04'), mkBarTx('c', '2026-07-05')];
    expect(countProfileOccasions(txs, 'prof-1', 'ph-1', '2026-07-04')).toBe(2);
    expect(countProfileOccasions(txs, 'prof-1', 'ph-1', null)).toBe(3);
  });

  it('null cut keeps the whole-phase count (legacy plans, no migration)', () => {
    const txs = [mkBarTx('a', '2026-06-20'), mkBarTx('b', '2026-07-04')];
    const withNull = calculateOccasionForecasts([baseProfile], allocations, txs, 'ph-1', null);
    const withoutArg = calculateOccasionForecasts([baseProfile], allocations, txs, 'ph-1');
    expect(withNull[0]!.spent).toBe(2);
    expect(withoutArg[0]!.spent).toBe(2);
  });
});
