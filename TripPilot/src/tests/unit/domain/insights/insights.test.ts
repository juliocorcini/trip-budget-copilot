import { describe, it, expect } from 'vitest';
import {
  buildDashboardInsights,
  createForecastSnapshot,
  INSIGHT_SAFETY_CAP,
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
    categoryRhythm: [],
    // Noon by default so the end-of-day nudge stays dormant in existing tests.
    nowHour: 12,
    // M11: no upcoming phase by default so the countdown stays dormant.
    nextPhase: null,
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

  function manySignalsInput() {
    // Spread spend across days so streak does NOT fire (a spend today breaks it),
    // letting projection + rhythm + avg + balance + next all surface together.
    const txs = [mkTx(2000, '2026-06-01'), mkTx(2000, '2026-06-03'), mkTx(2000, '2026-06-05')];
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
    return baseInput({
      todayDate: '2026-06-05',
      phaseTransactions: txs,
      phaseBudgetCents: 30_000,
      completedOutingTotalsCents: [3800, 2200],
      debts,
      occurrences: [occurrence],
    });
  }

  it('M1: shows ALL significant insights (no fixed cap of 4)', () => {
    const insights = buildDashboardInsights(manySignalsInput());
    // projection, rhythm, avg, balance, next all fire — 5 > the old cap of 4.
    expect(insights.length).toBe(5);
    expect(insights.length).toBeLessThanOrEqual(INSIGHT_SAFETY_CAP);
    const kinds = insights.map((i) => i.kind);
    expect(kinds).toContain('phase_projection');
    expect(kinds).toContain('rhythm_compare');
    expect(kinds).toContain('avg_outing_cost');
    expect(kinds).toContain('participant_balance');
    expect(kinds).toContain('next_event');
  });

  it('M1: orders insights by priority (projection > rhythm > balance > next > avg)', () => {
    const insights = buildDashboardInsights(manySignalsInput());
    const priorities = insights.map((i) => i.priority);
    const sortedDesc = [...priorities].sort((a, b) => b - a);
    expect(priorities).toEqual(sortedDesc);
    expect(insights[0]!.kind).toBe('phase_projection');
  });

  it('M1: never exceeds the safety cap even with every builder firing', () => {
    const insights = buildDashboardInsights(manySignalsInput());
    expect(insights.length).toBeLessThanOrEqual(INSIGHT_SAFETY_CAP);
  });
});

describe('M4 — category rhythm builder (anti-spam)', () => {
  it('fires when a category outruns the elapsed fraction (bar 60% on day 3/10)', () => {
    const insights = buildDashboardInsights(
      baseInput({
        todayDate: '2026-06-03',
        phaseTransactions: [mkTx(2000, '2026-06-01')],
        categoryRhythm: [{ category: 'bar', plannedCents: 10_000, spentCents: 6_000 }],
      }),
    );
    const rhythm = insights.find((i) => i.kind === 'category_rhythm')!;
    expect(rhythm).toBeDefined();
    expect(rhythm.values.category).toBe('bar');
    expect(rhythm.values.percent).toBe(60);
    expect(rhythm.values.daysElapsed).toBe(3);
    expect(rhythm.values.totalDays).toBe(10);
    expect(rhythm.tone).toBe('warning');
  });

  it('null when the category is on pace with elapsed time', () => {
    const insights = buildDashboardInsights(
      baseInput({
        todayDate: '2026-06-03',
        categoryRhythm: [{ category: 'bar', plannedCents: 10_000, spentCents: 3_000 }],
      }),
    );
    expect(insights.find((i) => i.kind === 'category_rhythm')).toBeUndefined();
  });

  it('null before 3 days of data, even when disproportionate', () => {
    const insights = buildDashboardInsights(
      baseInput({
        todayDate: '2026-06-02',
        categoryRhythm: [{ category: 'bar', plannedCents: 10_000, spentCents: 9_000 }],
      }),
    );
    expect(insights.find((i) => i.kind === 'category_rhythm')).toBeUndefined();
  });

  it('reports the worst offender among several categories', () => {
    const insights = buildDashboardInsights(
      baseInput({
        todayDate: '2026-06-03',
        categoryRhythm: [
          { category: 'bar', plannedCents: 10_000, spentCents: 5_000 }, // 50%
          { category: 'restaurant', plannedCents: 10_000, spentCents: 8_000 }, // 80%
        ],
      }),
    );
    const rhythm = insights.find((i) => i.kind === 'category_rhythm')!;
    expect(rhythm.values.category).toBe('restaurant');
    expect(rhythm.values.percent).toBe(80);
  });
});

describe('M5 — danger day builder (anti-spam)', () => {
  const longPhase = () => mkPhase({ endDate: '2026-06-30' });

  it('fires on a weekday that averages ≥1.8× the others (Saturday 5×)', () => {
    // Jun 6 and Jun 13 are the same weekday as Jun 20 (today); Jun 8/10 differ.
    const insights = buildDashboardInsights(
      baseInput({
        phase: longPhase(),
        todayDate: '2026-06-20',
        phaseTransactions: [
          mkTx(10_000, '2026-06-06'),
          mkTx(10_000, '2026-06-13'),
          mkTx(2_000, '2026-06-08'),
          mkTx(2_000, '2026-06-10'),
        ],
      }),
    );
    const danger = insights.find((i) => i.kind === 'danger_day')!;
    expect(danger).toBeDefined();
    expect(danger.values.weekday).toBe(new Date('2026-06-20T00:00:00').getDay());
    expect(danger.values.multiplier).toBe(5);
    expect(danger.tone).toBe('warning');
  });

  it('null with only one sample of the weekday (insufficient history)', () => {
    const insights = buildDashboardInsights(
      baseInput({
        phase: longPhase(),
        todayDate: '2026-06-20',
        phaseTransactions: [mkTx(10_000, '2026-06-13'), mkTx(2_000, '2026-06-10')],
      }),
    );
    expect(insights.find((i) => i.kind === 'danger_day')).toBeUndefined();
  });

  it('null when the weekday is not unusually expensive (uniform spend)', () => {
    const insights = buildDashboardInsights(
      baseInput({
        phase: longPhase(),
        todayDate: '2026-06-20',
        phaseTransactions: [
          mkTx(2_000, '2026-06-06'),
          mkTx(2_000, '2026-06-13'),
          mkTx(2_000, '2026-06-08'),
          mkTx(2_000, '2026-06-10'),
        ],
      }),
    );
    expect(insights.find((i) => i.kind === 'danger_day')).toBeUndefined();
  });

  it('ignores today own spend (forecast, not reaction)', () => {
    // Today is the only same-weekday day with spend → no past sample → null.
    const insights = buildDashboardInsights(
      baseInput({
        phase: longPhase(),
        todayDate: '2026-06-20',
        phaseTransactions: [mkTx(50_000, '2026-06-20'), mkTx(2_000, '2026-06-10')],
      }),
    );
    expect(insights.find((i) => i.kind === 'danger_day')).toBeUndefined();
  });
});

describe('M6 — end of day builder (anti-spam)', () => {
  it('fires in the evening when nothing is logged today', () => {
    const insights = buildDashboardInsights(
      baseInput({ todayDate: '2026-06-05', nowHour: 19, phaseTransactions: [mkTx(2000, '2026-06-04')] }),
    );
    const eod = insights.find((i) => i.kind === 'end_of_day')!;
    expect(eod).toBeDefined();
    expect(eod.priority).toBeGreaterThan(80); // highest — surfaces first
  });

  it('null in the morning even with nothing logged', () => {
    const insights = buildDashboardInsights(baseInput({ todayDate: '2026-06-05', nowHour: 9 }));
    expect(insights.find((i) => i.kind === 'end_of_day')).toBeUndefined();
  });

  it('null once something is logged today', () => {
    const insights = buildDashboardInsights(
      baseInput({ todayDate: '2026-06-05', nowHour: 21, phaseTransactions: [mkTx(2000, '2026-06-05')] }),
    );
    expect(insights.find((i) => i.kind === 'end_of_day')).toBeUndefined();
  });

  it('null outside the phase window', () => {
    const insights = buildDashboardInsights(baseInput({ todayDate: '2026-05-20', nowHour: 22 }));
    expect(insights.find((i) => i.kind === 'end_of_day')).toBeUndefined();
  });
});

describe('M11 — between-phases countdown builder', () => {
  it('fires inside the window with the per-day pace', () => {
    const insights = buildDashboardInsights(
      baseInput({
        phaseBudgetCents: 12_000,
        nextPhase: { name: 'Eurotrip', daysUntilStart: 3 },
      }),
    );
    const countdown = insights.find((i) => i.kind === 'phase_countdown')!;
    expect(countdown).toBeDefined();
    expect(countdown.values.name).toBe('Eurotrip');
    expect(countdown.values.days).toBe(3);
    // 12 000 free spread over 3 days = 4 000/day.
    expect(countdown.values.perDayCents).toBe(4_000);
  });

  it('spreads only the free amount (budget minus spend)', () => {
    const insights = buildDashboardInsights(
      baseInput({
        phaseBudgetCents: 12_000,
        phaseTransactions: [mkTx(3_000, '2026-06-02')],
        nextPhase: { name: 'Eurotrip', daysUntilStart: 3 },
      }),
    );
    const countdown = insights.find((i) => i.kind === 'phase_countdown')!;
    // (12 000 − 3 000) / 3 = 3 000/day.
    expect(countdown.values.perDayCents).toBe(3_000);
  });

  it('null outside the transition window (too far away)', () => {
    const insights = buildDashboardInsights(
      baseInput({ phaseBudgetCents: 12_000, nextPhase: { name: 'Eurotrip', daysUntilStart: 10 } }),
    );
    expect(insights.find((i) => i.kind === 'phase_countdown')).toBeUndefined();
  });

  it('null when there is no upcoming phase', () => {
    const insights = buildDashboardInsights(baseInput({ phaseBudgetCents: 12_000, nextPhase: null }));
    expect(insights.find((i) => i.kind === 'phase_countdown')).toBeUndefined();
  });

  it('null when there is no free money to pace', () => {
    const insights = buildDashboardInsights(
      baseInput({
        phaseBudgetCents: 5_000,
        phaseTransactions: [mkTx(5_000, '2026-06-02')],
        nextPhase: { name: 'Eurotrip', daysUntilStart: 2 },
      }),
    );
    expect(insights.find((i) => i.kind === 'phase_countdown')).toBeUndefined();
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
