import { describe, it, expect } from 'vitest';
import { buildPhaseBurndown } from '@/domain/dashboard';
import { createPhase } from '@/domain/phases';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Transaction } from '@/domain/types/transaction';

// DEC-130: phase burn-down — cumulative actual vs rhythm-aware ideal pace.

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

describe('buildPhaseBurndown', () => {
  it('builds a linear ideal line for uniform phases', () => {
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 50000,
      transactions: [],
      todayIso: '2026-06-03',
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
    });

    expect(burndown!.points.map((p) => p.idealCents)).toEqual([
      10000, 25000, 35000, 45000,
    ]);
  });

  it('clamps today to the last point after the phase ends', () => {
    const burndown = buildPhaseBurndown({
      phase,
      phaseBudgetCents: 50000,
      transactions: [mkTx(8000, '2026-06-05')],
      todayIso: '2026-07-15',
    });
    expect(burndown!.todayIndex).toBe(4);
    expect(burndown!.spentToDateCents).toBe(8000);
  });

  it('returns null without a budget, before the phase, or for 1-day phases', () => {
    expect(
      buildPhaseBurndown({ phase, phaseBudgetCents: 0, transactions: [], todayIso: '2026-06-03' }),
    ).toBeNull();
    expect(
      buildPhaseBurndown({
        phase,
        phaseBudgetCents: 50000,
        transactions: [],
        todayIso: '2026-05-20',
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
      }),
    ).toBeNull();
  });
});
