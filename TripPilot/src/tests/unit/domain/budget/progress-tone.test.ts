import { describe, it, expect } from 'vitest';
import { resolveProgressTone } from '@/domain/budget';

/**
 * C12 / DEC-299 — a budget progress bar only turns red on a REAL problem.
 * Normal progress (even near the end of a phase) stays positive; red is reserved
 * for overspent / over-limit / into-the-protected-reserve.
 */
describe('resolveProgressTone (C12 / DEC-299 bar color policy)', () => {
  it('is positive on early progress (€300 spent of €1000, plenty free)', () => {
    expect(
      resolveProgressTone({
        trueFreeCents: 60000,
        totalBudgetCents: 100000,
        totalSpentCents: 30000,
        protectedReserveCents: 10000,
      }),
    ).toBe('positive');
  });

  it('stays positive at 95% used while money is still free (near-the-end ≠ problem)', () => {
    // The exact scare this fixes: 95% used would read "critical" under a percent
    // model, but the user still has €50 truly free and is below the limit.
    expect(
      resolveProgressTone({
        trueFreeCents: 5000,
        totalBudgetCents: 100000,
        totalSpentCents: 95000,
        protectedReserveCents: 0,
      }),
    ).toBe('positive');
  });

  it('turns risk when the free money is gone (trueFree < 0)', () => {
    expect(
      resolveProgressTone({
        trueFreeCents: -1200,
        totalBudgetCents: 100000,
        totalSpentCents: 90000,
        protectedReserveCents: 0,
      }),
    ).toBe('risk');
  });

  it('turns risk when spent over the whole limit (€1010 of €1000)', () => {
    expect(
      resolveProgressTone({
        trueFreeCents: 0,
        totalBudgetCents: 100000,
        totalSpentCents: 101000,
        protectedReserveCents: 0,
      }),
    ).toBe('risk');
  });

  it('turns risk when spending dips into the protected reserve', () => {
    // Budget €1000, reserve €200 → spendable €800; €850 spent is €50 into reserve.
    expect(
      resolveProgressTone({
        trueFreeCents: 0,
        totalBudgetCents: 100000,
        totalSpentCents: 85000,
        protectedReserveCents: 20000,
      }),
    ).toBe('risk');
  });

  it('exactly at the reserve edge is still positive (not yet into reserve)', () => {
    // €800 spent of €1000 with €200 reserve = exactly the spendable edge.
    expect(
      resolveProgressTone({
        trueFreeCents: 0,
        totalBudgetCents: 100000,
        totalSpentCents: 80000,
        protectedReserveCents: 20000,
      }),
    ).toBe('positive');
  });

  it('no budget set (0) never invents an over-limit risk on its own', () => {
    expect(
      resolveProgressTone({
        trueFreeCents: 1000,
        totalBudgetCents: 0,
        totalSpentCents: 50000,
        protectedReserveCents: 0,
      }),
    ).toBe('positive');
  });
});
