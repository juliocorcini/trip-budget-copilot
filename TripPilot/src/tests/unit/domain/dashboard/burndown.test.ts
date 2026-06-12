import { describe, it, expect } from 'vitest';
import { buildPhaseBurndown } from '@/domain/dashboard';
import { createPhase } from '@/domain/phases';
import { createExpenseTransaction } from '@/domain/transactions';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

// DEC-130 + DEC-136: phase burn-down — cumulative actual vs the planned
// ideal pace (rhythm weights + dated events as steps).

const phase = createPhase({
  tripId: 'trip-1',
  name: 'Madrid',
  startDate: '2026-06-01',
  endDate: '2026-06-05',
  order: 0,
});

function mkTx(amountCents: number, dayIso: string): Transaction {
  const tx = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: phase.id,
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'test',
  });
  return { ...tx, date: `${dayIso}T14:00:00.000Z` };
}

function mkOccurrence(overrides: Partial<PlannedOccurrence>): PlannedOccurrence {
  return {
    ...createSyncMetadata(),
    tripId: 'trip-1',
    phaseId: phase.id,
    activityProfileId: null,
    budgetPoolId: 'pool-1',
    name: 'Show',
    plannedDate: null,
    endDate: null,
    kind: 'event',
    estimatedCostCents: 0,
    reservedCents: null,
    isConfirmed: false,
    linkedTransactionId: null,
    linkedSessionId: null,
    notes: null,
    ...overrides,
  };
}

describe('buildPhaseBurndown', () => {
  it('builds a linear ideal line for uniform phases', () => {
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 50000,
      transactions: [],
      todayIso: '2026-06-03',
      occurrences: [],
    });

    expect(burndown!.points.map((p) => p.idealCents)).toEqual([
      10000, 20000, 30000, 40000, 50000,
    ]);
    // The ideal line always lands exactly on the budget.
    expect(burndown!.points[burndown!.points.length - 1]!.idealCents).toBe(50000);
  });

  it('accumulates actual spending up to today and leaves the future null', () => {
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 50000,
      transactions: [mkTx(5000, '2026-06-01'), mkTx(15000, '2026-06-02'), mkTx(7000, '2026-06-03')],
      todayIso: '2026-06-03',
      occurrences: [],
    });

    expect(burndown!.points.map((p) => p.actualCents)).toEqual([
      5000, 20000, 27000, null, null,
    ]);
    expect(burndown!.todayIndex).toBe(2);
    expect(burndown!.spentToDateCents).toBe(27000);
    expect(burndown!.idealToDateCents).toBe(30000);
    expect(burndown!.deltaCents).toBe(-3000);
    expect(burndown!.abovePace).toBe(false);
  });

  it('flags spending above the planned pace', () => {
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 50000,
      transactions: [mkTx(25000, '2026-06-01'), mkTx(10000, '2026-06-02')],
      todayIso: '2026-06-02',
      occurrences: [],
    });

    expect(burndown!.spentToDateCents).toBe(35000);
    expect(burndown!.idealToDateCents).toBe(20000);
    expect(burndown!.deltaCents).toBe(15000);
    expect(burndown!.abovePace).toBe(true);
  });

  it('releases more budget on peak days (rhythm-aware ideal)', () => {
    // Mon 06-01 .. Thu 06-04 with Tuesday (weekday 2) as the peak:
    // weights 1, 1.5, 1, 1 (total 4.5) on a 45000 budget.
    const peakPhase = {
      ...createPhase({
        tripId: 'trip-1',
        name: 'Peak',
        startDate: '2026-06-01',
        endDate: '2026-06-04',
        order: 0,
      }),
      peakDays: [2],
    };
    const burndown = buildPhaseBurndown({
      phase: peakPhase,
      phaseBudgetCents: 45000,
      transactions: [],
      todayIso: '2026-06-01',
      occurrences: [],
    });

    expect(burndown!.points.map((p) => p.idealCents)).toEqual([
      10000, 25000, 35000, 45000,
    ]);
  });

  // DEC-136: dated occurrences are released on their planned day.

  it('adds a pending dated event as a step on its day (reserve added back)', () => {
    // Budget passed in is free+spent = 40000; the €100 reserve was already
    // deducted from free — the chart adds it back (envelope 50000).
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 40000,
      transactions: [],
      todayIso: '2026-06-01',
      occurrences: [
        mkOccurrence({ plannedDate: '2026-06-03', reservedCents: 10000 }),
      ],
    });

    expect(burndown!.budgetCents).toBe(50000);
    expect(burndown!.points.map((p) => p.idealCents)).toEqual([
      8000, 16000, 34000, 42000, 50000,
    ]);
  });

  it('keeps the step for confirmed events without double-counting the reserve', () => {
    // Confirmed: the spend is already inside phaseBudget (free+spent) and
    // calculateEventReserves ignores it — only the step remains.
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 50000,
      transactions: [],
      todayIso: '2026-06-01',
      occurrences: [
        mkOccurrence({ plannedDate: '2026-06-03', reservedCents: 10000, isConfirmed: true }),
      ],
    });

    expect(burndown!.budgetCents).toBe(50000);
    expect(burndown!.points.map((p) => p.idealCents)).toEqual([
      8000, 16000, 34000, 42000, 50000,
    ]);
  });

  it('spreads multi-day occurrences evenly over their interval', () => {
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 36000,
      transactions: [],
      todayIso: '2026-06-01',
      occurrences: [
        mkOccurrence({
          plannedDate: '2026-06-02',
          endDate: '2026-06-04',
          reservedCents: 9000,
          kind: 'sub_destination',
        }),
      ],
    });

    expect(burndown!.points.map((p) => p.idealCents)).toEqual([
      7200, 17400, 27600, 37800, 45000,
    ]);
  });

  it('dilutes undated reserves into the daily rhythm (no step)', () => {
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 40000,
      transactions: [],
      todayIso: '2026-06-01',
      occurrences: [mkOccurrence({ plannedDate: null, reservedCents: 10000 })],
    });

    expect(burndown!.budgetCents).toBe(50000);
    expect(burndown!.points.map((p) => p.idealCents)).toEqual([
      10000, 20000, 30000, 40000, 50000,
    ]);
  });

  it('clamps today to the last point after the phase ends', () => {
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 50000,
      transactions: [mkTx(8000, '2026-06-05')],
      todayIso: '2026-07-15',
      occurrences: [],
    });
    expect(burndown!.todayIndex).toBe(4);
    expect(burndown!.spentToDateCents).toBe(8000);
  });

  it('returns null without a budget, before the phase, or for 1-day phases', () => {
    expect(
      buildPhaseBurndown({ phase, phaseBudgetCents: 0, transactions: [], todayIso: '2026-06-03', occurrences: [] }),
    ).toBeNull();
    expect(
      buildPhaseBurndown({
        phase,
        phaseBudgetCents: 50000,
        transactions: [],
        todayIso: '2026-05-20',
        occurrences: [],
      }),
    ).toBeNull();
    const oneDay = createPhase({
      tripId: 'trip-1',
      name: 'One',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      order: 0,
    });
    expect(
      buildPhaseBurndown({
        phase: oneDay,
        phaseBudgetCents: 50000,
        transactions: [],
        todayIso: '2026-06-01',
        occurrences: [],
      }),
    ).toBeNull();
  });
});
