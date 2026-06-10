import { describe, it, expect } from 'vitest';
import {
  buildDashboardInsights,
  createForecastSnapshot,
  MAX_INSIGHTS_PER_DAY,
  type BuildInsightsInput,
} from '@/domain/insights';
import { orderForecastsByUsage, type OccasionForecast } from '@/domain/forecasting';
import { createPhase } from '@/domain/phases';
import { createExpenseTransaction } from '@/domain/transactions';
import { createPlannedOccurrence } from '@/domain/planning';
import type { DebtEntry } from '@/domain/splitting';

const OWNER_ID = 'owner-1';

function mkPhase(overrides: Partial<Parameters<typeof createPhase>[0]> = {}) {
  return createPhase({
    tripId: 'trip-1',
    name: 'Madrid',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
    order: 1,
    ...overrides,
  });
}

function mkTx(amountCents: number, date: string) {
  const tx = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    subcategoryId: null,
    description: 'expense',
  });
  return { ...tx, date: `${date}T12:00:00.000Z` };
}

function baseInput(overrides: Partial<BuildInsightsInput> = {}): BuildInsightsInput {
  return {
    todayDate: '2026-06-05',
    phase: mkPhase(),
    phaseTransactions: [],
    phaseBudgetCents: 0,
    completedOutingTotalsCents: [],
    debts: [],
    ownerId: OWNER_ID,
    occurrences: [],
    ...overrides,
  };
}

describe('buildDashboardInsights (DEC-077 — FIELD-07)', () => {
  it('no data → no insights (significance rules)', () => {
    expect(buildDashboardInsights(baseInput())).toEqual([]);
  });

  it('projection needs ≥3 days of data', () => {
    const txs = [mkTx(2000, '2026-06-01'), mkTx(2000, '2026-06-02')];
    const early = buildDashboardInsights(
      baseInput({ todayDate: '2026-06-02', phaseTransactions: txs, phaseBudgetCents: 50_000 }),
    );
    expect(early.find((i) => i.kind === 'phase_projection')).toBeUndefined();

    const later = buildDashboardInsights(
      baseInput({ todayDate: '2026-06-03', phaseTransactions: txs, phaseBudgetCents: 50_000 }),
    );
    expect(later.find((i) => i.kind === 'phase_projection')).toBeDefined();
  });

  it('uniform phase projection: €20/day for 3 of 10 days → projects €200', () => {
    // Spent 6000 in 3 elapsed days (Jun 1-3), 7 remaining → 6000 + 2000×7 = 20000.
    const txs = [mkTx(2000, '2026-06-01'), mkTx(2000, '2026-06-02'), mkTx(2000, '2026-06-03')];
    const insights = buildDashboardInsights(
      baseInput({ todayDate: '2026-06-03', phaseTransactions: txs, phaseBudgetCents: 18_000 }),
    );
    const projection = insights.find((i) => i.kind === 'phase_projection')!;
    expect(projection.values.projectedCents).toBe(20_000);
    expect(projection.values.over).toBe(1);
    expect(projection.values.diffCents).toBe(2_000);
    expect(projection.tone).toBe('warning');
  });

  it('rhythm compare: real €20/day vs planned €10/day → warning', () => {
    const txs = [mkTx(2000, '2026-06-01'), mkTx(2000, '2026-06-02'), mkTx(2000, '2026-06-03')];
    const insights = buildDashboardInsights(
      baseInput({ todayDate: '2026-06-03', phaseTransactions: txs, phaseBudgetCents: 10_000 }),
    );
    const rhythm = insights.find((i) => i.kind === 'rhythm_compare')!;
    expect(rhythm.values.realDailyCents).toBe(2000);
    expect(rhythm.values.plannedDailyCents).toBe(1000);
    expect(rhythm.tone).toBe('warning');
  });

  it('no-spend streak: last expense 3 days ago → streak of 3', () => {
    const insights = buildDashboardInsights(
      baseInput({ todayDate: '2026-06-05', phaseTransactions: [mkTx(2000, '2026-06-02')] }),
    );
    const streak = insights.find((i) => i.kind === 'no_spend_streak')!;
    expect(streak.values.days).toBe(3);
    expect(streak.tone).toBe('positive');
  });

  it('avg outing cost needs ≥2 completed outings', () => {
    const one = buildDashboardInsights(baseInput({ completedOutingTotalsCents: [3800] }));
    expect(one.find((i) => i.kind === 'avg_outing_cost')).toBeUndefined();

    const two = buildDashboardInsights(
      baseInput({ completedOutingTotalsCents: [3800, 2200] }),
    );
    const avg = two.find((i) => i.kind === 'avg_outing_cost')!;
    expect(avg.values.avgCents).toBe(3000);
    expect(avg.values.count).toBe(2);
  });

  it('participant balance picks the largest owner debt ("Mira te deve €12")', () => {
    const debts: DebtEntry[] = [
      { debtorId: 'mira', debtorName: 'Mira', creditorId: OWNER_ID, creditorName: 'Julio', amountCents: 1200 },
      { debtorId: OWNER_ID, debtorName: 'Julio', creditorId: 'ana', creditorName: 'Ana', amountCents: 500 },
    ];
    const insights = buildDashboardInsights(baseInput({ debts }));
    const balance = insights.find((i) => i.kind === 'participant_balance')!;
    expect(balance.values.name).toBe('Mira');
    expect(balance.values.amountCents).toBe(1200);
    expect(balance.values.owedToMe).toBe(1);
  });

  it('next event: upcoming unconfirmed occurrence with reserve', () => {
    const occurrence = createPlannedOccurrence({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Praia',
      plannedDate: '2026-06-08',
      endDate: null,
      kind: 'event',
      estimatedCostCents: 12_000,
      reservedCents: 12_000,
      activityProfileId: null,
    });
    const insights = buildDashboardInsights(baseInput({ occurrences: [occurrence] }));
    const next = insights.find((i) => i.kind === 'next_event')!;
    expect(next.values.name).toBe('Praia');
    expect(next.values.days).toBe(3);
    expect(next.values.hasReserve).toBe(1);
  });

  it('caps at MAX_INSIGHTS_PER_DAY significant cards', () => {
    const txs = [mkTx(2000, '2026-06-01'), mkTx(2000, '2026-06-02')];
    const debts: DebtEntry[] = [
      { debtorId: 'mira', debtorName: 'Mira', creditorId: OWNER_ID, creditorName: 'Julio', amountCents: 1200 },
    ];
    const occurrence = createPlannedOccurrence({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Praia',
      plannedDate: '2026-06-08',
      endDate: null,
      kind: 'event',
      estimatedCostCents: 12_000,
      reservedCents: null,
      activityProfileId: null,
    });
    const insights = buildDashboardInsights(
      baseInput({
        todayDate: '2026-06-05',
        phaseTransactions: txs,
        phaseBudgetCents: 30_000,
        completedOutingTotalsCents: [3800, 2200],
        debts,
        occurrences: [occurrence],
      }),
    );
    // 5 builders fire (projection, rhythm, streak, avg, balance, next) → capped.
    expect(insights.length).toBeLessThanOrEqual(MAX_INSIGHTS_PER_DAY);
    expect(insights.length).toBe(MAX_INSIGHTS_PER_DAY);
  });
});

describe('createForecastSnapshot (DEC-077 — M8.3)', () => {
  it('confidence grows with days of data', () => {
    const base = {
      tripId: 'trip-1',
      phaseId: 'phase-1',
      snapshotDate: '2026-06-05',
      totalBudgetCents: 100_000,
      totalSpentCents: 20_000,
      freeToSpendCents: 60_000,
      avgDailySpendCents: 4_000,
      projectedEndSpendCents: 40_000,
    };
    expect(createForecastSnapshot({ ...base, daysOfData: 1 }).confidence).toBe('low');
    expect(createForecastSnapshot({ ...base, daysOfData: 4 }).confidence).toBe('medium');
    expect(createForecastSnapshot({ ...base, daysOfData: 8 }).confidence).toBe('high');
    const snapshot = createForecastSnapshot({ ...base, daysOfData: 8 });
    expect(snapshot.snapshotDate).toBe('2026-06-05');
    expect(snapshot.deletedAt).toBeNull();
  });
});

describe('orderForecastsByUsage (DEC-076 — FIELD-06)', () => {
  const mk = (id: string, spent: number, planned: number): OccasionForecast => ({
    profileId: id,
    profileName: id,
    remaining: Math.max(0, planned - spent),
    totalPlanned: planned,
    spent,
    estimatedRemainingCostCents: 0,
  });

  it('used profiles first, desc by usage; planned-unused keep plan order', () => {
    const ordered = orderForecastsByUsage([
      mk('market', 1, 3),
      mk('bar', 4, 5),
      mk('tour', 0, 2),
      mk('restaurant', 2, 4),
    ]);
    expect(ordered.map((f) => f.profileId)).toEqual(['bar', 'restaurant', 'market', 'tour']);
  });

  it('no usage at all → most planned first (previous behavior)', () => {
    const ordered = orderForecastsByUsage([
      mk('market', 0, 2),
      mk('bar', 0, 5),
      mk('tour', 0, 3),
    ]);
    expect(ordered.map((f) => f.profileId)).toEqual(['bar', 'tour', 'market']);
  });
});
