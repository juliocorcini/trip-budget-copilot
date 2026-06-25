import { describe, it, expect } from 'vitest';
import { buildPiggyLedger, type PiggyDaySpend } from '@/domain/budget/piggy-ledger';
import { classifyBudgetSignal } from '@/domain/budget/budget-signal';

/**
 * E09 · DEC-329 — pace × plan × piggy are mutually consistent, not contradictory.
 *
 * The field scare: the phase rhythm says "you're above pace", the copilot
 * projection says "12 above plan, reserve at risk" — yet the cofrinho still holds
 * €32. Three TRUE statements that read as a contradiction. They are not: they are
 * three independent lenses on the SAME immutable spend, and this suite proves the
 * numbers reconcile (no math change — only the copy that explains them, added on
 * the Copilot's "where it's heading" block, was new in G6).
 *
 *  - PACE / piggy  → `buildPiggyLedger`: the CUMULATIVE buffer (what early calm
 *    days banked), dented but not erased by a recent heavy day.
 *  - PLAN / forecast → `classifyBudgetSignal`: a FORWARD projection over budget is
 *    a forecast, never a real-money problem on its own.
 */

/** Build a contiguous spend series from a plain cents array (synthetic dates). */
function days(spend: number[]): PiggyDaySpend[] {
  return spend.map((spentCents, i) => ({
    dateIso: `2026-07-${String(i + 1).padStart(2, '0')}`,
    spentCents,
  }));
}

describe('pace × plan × piggy reconciliation (E09 · DEC-329)', () => {
  // €10/day ideal; four calm days bank €40, then a €18 day (above the daily
  // ideal — "above pace") dips the buffer to €32. The exact field scenario.
  const DAILY_IDEAL = 1000;
  const ledger = buildPiggyLedger({ dailyIdealCents: DAILY_IDEAL, spendByDay: days([0, 0, 0, 0, 1800]) });

  it('the cofrinho keeps the early savings even after a recent above-pace day', () => {
    // Banked 4×€10, then withdrew €8 to cover the €18 day → €32 left.
    expect(ledger.balanceCents).toBe(3200);
    const last = ledger.entries[ledger.entries.length - 1]!;
    expect(last.kind).toBe('withdrawal'); // the recent heavy day dipped the buffer
    expect(last.spentCents).toBeGreaterThan(DAILY_IDEAL); // ...and it WAS above pace
    expect(ledger.balanceCents).toBeGreaterThan(0); // yet the buffer survives
  });

  it('the buffer is internally consistent: deposited − withdrawn === balance (no double-count)', () => {
    expect(ledger.totalDepositedCents - ledger.totalWithdrawnCents).toBe(ledger.balanceCents);
    expect(ledger.totalDepositedCents).toBe(4000);
    expect(ledger.totalWithdrawnCents).toBe(800);
    expect(ledger.totalUncoveredCents).toBe(0); // the buffer fully covered the dip
  });

  it('"above plan / above pace" with real spend OK is a forecast, not a real problem', () => {
    // 12 over plan by projection, real spend on track → projection_over, NOT red.
    const projectionOnly = classifyBudgetSignal({
      realSpendOverCents: 0,
      overAllocationCents: 0,
      projectedOverCents: 1200,
    });
    expect(projectionOnly.kind).toBe('projection_over');
    expect(projectionOnly.isRealProblem).toBe(false);

    // The Planner's red (future allocation over) with real spend OK is likewise
    // a planning signal, not an alarm — so it never contradicts a positive piggy.
    const allocationOnly = classifyBudgetSignal({
      realSpendOverCents: 0,
      overAllocationCents: 600,
      projectedOverCents: 0,
    });
    expect(allocationOnly.kind).toBe('allocation_over');
    expect(allocationOnly.isRealProblem).toBe(false);
  });

  it('only a real overspend is ever a red — and that is the one case the piggy would be emptied first', () => {
    const realOver = classifyBudgetSignal({
      realSpendOverCents: 500,
      overAllocationCents: 600,
      projectedOverCents: 1200,
    });
    expect(realOver.kind).toBe('real_over');
    expect(realOver.isRealProblem).toBe(true);
  });
});
