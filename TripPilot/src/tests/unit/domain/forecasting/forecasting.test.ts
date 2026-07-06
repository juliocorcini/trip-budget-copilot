import { describe, it, expect } from 'vitest';
import {
  updateProfileFromTransaction,
  simulateSpend,
  simulateSpendMultiMetric,
  calculateScenarioCost,
  calculateOccasionForecasts,
  calculatePlanProgress,
  countProfileOccasions,
} from '@/domain/forecasting';
import { calculateTrueFree } from '@/domain/budget';
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

    expect(countProfileOccasions(txs, 'prof-1', 'bar', 'ph-1')).toBe(5);

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
    expect(countProfileOccasions(txs, 'prof-1', 'bar', 'ph-1', '2026-07-04')).toBe(2);
    expect(countProfileOccasions(txs, 'prof-1', 'bar', 'ph-1', null)).toBe(3);
  });

  it('null cut keeps the whole-phase count (legacy plans, no migration)', () => {
    const txs = [mkBarTx('a', '2026-06-20'), mkBarTx('b', '2026-07-04')];
    const withNull = calculateOccasionForecasts([baseProfile], allocations, txs, 'ph-1', null);
    const withoutArg = calculateOccasionForecasts([baseProfile], allocations, txs, 'ph-1');
    expect(withNull[0]!.spent).toBe(2);
    expect(withoutArg[0]!.spent).toBe(2);
  });
});

// DEC-472 (field 2026-07-06) — plan consumption by CATEGORY. Julio's €42 market
// receipt (category only, no activityProfileId — receipts/quick-adds never set
// one) left the free pool while the "2 mercados" plan sat untouched at "0
// feitos". Orphan spends of a profile's real category now consume its plan.
describe('countProfileOccasions — category scope (DEC-472)', () => {
  const marketProfile: ActivityProfile = {
    ...baseProfile,
    id: 'prof-mkt',
    name: 'Mercado',
    category: 'market',
  };
  const mkTx = (
    id: string,
    overrides: { category?: string; activityProfileId?: string | null; sessionId?: string | null; date?: string },
  ) => ({
    ...meta,
    id,
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: overrides.sessionId ?? null,
    type: 'expense' as const,
    amountCents: 4200,
    personalCostCents: 4200,
    currency: 'EUR',
    baseCurrencyAmountCents: 4200,
    exchangeRate: null,
    category: overrides.category ?? 'market',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'test',
    date: overrides.date ?? '2026-07-05T12:00:00.000Z',
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: overrides.activityProfileId ?? null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
  });
  const marketAllocations: ScenarioAllocationItem[] = [
    { ...meta, id: 'a-mkt', scenarioPlanId: 'sp1', activityProfileId: 'prof-mkt', quantity: 2, estimatedUnitCostCents: 4000, isLocked: false, priority: 'planned', notes: null },
  ];

  it("Julio's market receipt: category-only spend consumes the plan (2 planned → 1 remaining)", () => {
    // Receipt rows share ONE session → a single occasion (DEC-262 intact).
    const txs = [
      mkTx('r1', { sessionId: 'receipt-1' }),
      mkTx('r2', { sessionId: 'receipt-1' }),
      mkTx('r3', { sessionId: 'receipt-1' }),
    ];
    const forecasts = calculateOccasionForecasts([marketProfile], marketAllocations, txs, 'ph-1');
    expect(forecasts[0]!.spent).toBe(1);
    expect(forecasts[0]!.remaining).toBe(1);
  });

  it('a spend explicitly tagged to ANOTHER profile is never adopted by category', () => {
    const txs = [mkTx('x1', { activityProfileId: 'prof-OTHER' })];
    expect(countProfileOccasions(txs, 'prof-mkt', 'market', 'ph-1')).toBe(0);
  });

  it("custom 'other' profiles stay id-only — generic 'other' spends never consume them", () => {
    const txs = [
      mkTx('o1', { category: 'other' }),
      mkTx('o2', { category: 'other', activityProfileId: 'prof-spa' }),
    ];
    expect(countProfileOccasions(txs, 'prof-spa', 'other', 'ph-1')).toBe(1);
  });

  it('category adoption still honors the DEC-463 window (pre-cut orphans stay out)', () => {
    const txs = [
      mkTx('old', { date: '2026-06-20T12:00:00.000Z' }),
      mkTx('new', { date: '2026-07-05T12:00:00.000Z' }),
    ];
    expect(countProfileOccasions(txs, 'prof-mkt', 'market', 'ph-1', '2026-07-01')).toBe(1);
  });
});

// DEC-477 (field 2026-07-06) — the ONE plan-progress ruler. Julio's review:
// "17 bares no planejador para aparecer 1 restante… e isso comeu todo o resto"
// (255 reserved), planner margin −71 vs home −19, "Bar 103 de 45", restaurant
// showing €106 with zero plan. The reserve must be forward-looking only.
describe('calculatePlanProgress (DEC-477)', () => {
  const barProfile477: ActivityProfile = {
    ...baseProfile,
    id: 'pf-bar',
    name: 'Bar',
    category: 'bar',
    typicalValueCents: 1_500, // €15/bar
  };
  const marketProfile477: ActivityProfile = {
    ...baseProfile,
    id: 'pf-mkt',
    name: 'Mercado',
    category: 'market',
    typicalValueCents: 4_000, // €40/market
  };
  const restaurantProfile477: ActivityProfile = {
    ...baseProfile,
    id: 'pf-rest',
    name: 'Restaurante',
    category: 'restaurant',
    typicalValueCents: 2_000,
  };

  const alloc = (profileId: string, quantity: number): ScenarioAllocationItem => ({
    ...meta,
    id: `al-${profileId}-${quantity}`,
    scenarioPlanId: 'sp1',
    activityProfileId: profileId,
    quantity,
    estimatedUnitCostCents: 0,
    isLocked: false,
    priority: 'planned',
    notes: null,
  });

  const mkSpend = (
    id: string,
    category: string,
    amountCents: number,
    dateIso = '2026-07-05',
  ) => ({
    ...meta,
    id,
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense' as const,
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
    description: 'test',
    date: `${dateIso}T14:00:00.000Z`,
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

  it("Julio's 17 bars with 16 done: reserve holds exactly ONE bar slot, never 17", () => {
    // 16 cheap bar nights (€6 each = €96 total, less than 16×€15=€240 typical).
    const txs = Array.from({ length: 16 }, (_, i) => mkSpend(`bar-${i}`, 'bar', 600));
    const progress = calculatePlanProgress([barProfile477], [alloc('pf-bar', 17)], txs, 'ph-1');
    const bar = progress.lines.find((l) => l.profileId === 'pf-bar')!;
    expect(bar.planned).toBe(17);
    expect(bar.done).toBe(16);
    expect(bar.remaining).toBe(1);
    // The old money-only clamp reserved 17×15 − 96 = €159. The done-aware
    // ruler releases the 16 done slots: reserve = 1 remaining × €15.
    expect(bar.reserveCents).toBe(1_500);
    expect(progress.reserveCents).toBe(1_500);
  });

  it('money overshoot zeroes the reserve and surfaces as overspent ("Bar 103 de 45")', () => {
    // 3 planned × €15 = €45 envelope; €103 already spent in 3 outings.
    const txs = [
      mkSpend('b1', 'bar', 4_000),
      mkSpend('b2', 'bar', 4_000),
      mkSpend('b3', 'bar', 2_300),
    ];
    const progress = calculatePlanProgress([barProfile477], [alloc('pf-bar', 3)], txs, 'ph-1');
    const bar = progress.lines[0]!;
    expect(bar.plannedCents).toBe(4_500);
    expect(bar.spentCents).toBe(10_300);
    expect(bar.reserveCents).toBe(0);
    expect(bar.overspentCents).toBe(5_800); // "estourou +58"
    expect(bar.remaining).toBe(0);
  });

  it('spend without any plan is labeled out-of-plan and reserves nothing (the €106 restaurant)', () => {
    const txs = [mkSpend('r1', 'restaurant', 10_600)];
    const progress = calculatePlanProgress(
      [restaurantProfile477],
      [], // zero allocations — no plan for restaurant
      txs,
      'ph-1',
    );
    const rest = progress.lines[0]!;
    expect(rest.outOfPlan).toBe(true);
    expect(rest.plannedCents).toBe(0);
    expect(rest.spentCents).toBe(10_600);
    expect(rest.reserveCents).toBe(0);
    expect(progress.allocatedCents).toBe(0);
    expect(progress.reserveCents).toBe(0);
  });

  it('a done occasion cheaper than typical still releases its full slot', () => {
    // 3 markets planned ×€40; ONE receipt of €42 done → 2 slots reserved (€80),
    // consumed = max(€42, 1×€40) = €42 (money wins when higher than the slot).
    const txs = [mkSpend('m1', 'market', 4_200)];
    const progress = calculatePlanProgress(
      [marketProfile477],
      [alloc('pf-mkt', 3)],
      txs,
      'ph-1',
    );
    const mkt = progress.lines[0]!;
    expect(mkt.done).toBe(1);
    expect(mkt.remaining).toBe(2);
    expect(mkt.consumedCents).toBe(4_200);
    expect(mkt.reserveCents).toBe(12_000 - 4_200); // €78 still committed
  });

  it('honors the DEC-463 countFrom window exactly like the occasion counters', () => {
    const txs = [
      mkSpend('old', 'bar', 1_500, '2026-06-20'),
      mkSpend('new', 'bar', 1_500, '2026-07-05'),
    ];
    const windowed = calculatePlanProgress(
      [barProfile477],
      [alloc('pf-bar', 4)],
      txs,
      'ph-1',
      '2026-07-01',
    );
    expect(windowed.lines[0]!.done).toBe(1);
    expect(windowed.lines[0]!.spentCents).toBe(1_500);
    const wholePhase = calculatePlanProgress(
      [barProfile477],
      [alloc('pf-bar', 4)],
      txs,
      'ph-1',
      null,
    );
    expect(wholePhase.lines[0]!.done).toBe(2);
    expect(wholePhase.lines[0]!.spentCents).toBe(3_000);
  });

  it('feeds calculateTrueFree: margin == available − reserve (the −71 vs −19 fix)', () => {
    // Julio-like numbers: phase free €165, plan of 3 bars ×€15, 2 done cheap.
    const txs = [mkSpend('b1', 'bar', 600), mkSpend('b2', 'bar', 600)];
    const progress = calculatePlanProgress([barProfile477], [alloc('pf-bar', 3)], txs, 'ph-1');
    const trueFree = calculateTrueFree(16_500, progress.allocatedCents, progress.allocatedSpentCents);
    // reserve = 1 remaining × €15 = €15 → planner margin = 165 − 15 = 150.
    expect(trueFree.planReservedCents).toBe(progress.reserveCents);
    expect(trueFree.planReservedCents).toBe(1_500);
    expect(trueFree.trueFreeCents).toBe(15_000);
    // The OLD planner math would show 165 − 45 (full allocation) = 120 — a
    // different number from the home. Same function ⇒ same value everywhere.
  });

  it('aggregates multiple profiles into one honest reserve', () => {
    const txs = [
      ...Array.from({ length: 16 }, (_, i) => mkSpend(`bar-${i}`, 'bar', 600)),
      mkSpend('m1', 'market', 4_200),
      mkSpend('r1', 'restaurant', 10_600),
    ];
    const progress = calculatePlanProgress(
      [barProfile477, marketProfile477, restaurantProfile477],
      [alloc('pf-bar', 17), alloc('pf-mkt', 3)],
      txs,
      'ph-1',
    );
    // bar: 1 remaining ×15 = 1500; market: 12000 − 4200 = 7800; restaurant: 0.
    expect(progress.reserveCents).toBe(1_500 + 7_800);
    expect(progress.allocatedCents).toBe(17 * 1_500 + 3 * 4_000);
    expect(progress.allocatedSpentCents).toBe(progress.allocatedCents - progress.reserveCents);
  });
});
