/**
 * C12 / DEC-299 — bar color policy. A budget progress bar must only read as an
 * alert when there is a REAL problem (the free money is gone / spent over the
 * limit / spending dipped into the protected reserve). Normal progress — even at
 * 95% of a phase, or on its last day — stays neutral/positive, because being
 * near the end of a phase is NOT a problem.
 *
 * This is the single source of truth for "what color is this bar?", kept pure
 * (no React, integer cents) so it is reusable on any surface and unit-testable
 * with concrete numbers. It deliberately does NOT use percent thresholds (the
 * old `getBudgetHealthStatus` turned "critical" at 90% used — the exact scare
 * this fixes); it keys on actual overspend instead.
 */
export type ProgressTone = 'positive' | 'risk';

export interface ProgressToneInput {
  /** Truly-free cents (the hero number). < 0 means the user has overspent. */
  trueFreeCents: number;
  /** Total budget for the period. 0 = no explicit limit set. */
  totalBudgetCents: number;
  /** Total already spent in the period. */
  totalSpentCents: number;
  /** Protected reserve cents that should not be spent. */
  protectedReserveCents: number;
}

export function resolveProgressTone(input: ProgressToneInput): ProgressTone {
  const { trueFreeCents, totalBudgetCents, totalSpentCents, protectedReserveCents } = input;
  // The free money is gone (and then some) — a real problem.
  const overspent = trueFreeCents < 0;
  // Spent past the whole budget — over the limit.
  const overLimit = totalBudgetCents > 0 && totalSpentCents > totalBudgetCents;
  // Spending has eaten into the protected (untouchable) reserve.
  const intoReserve =
    protectedReserveCents > 0 &&
    totalBudgetCents > 0 &&
    totalSpentCents > totalBudgetCents - protectedReserveCents;
  return overspent || overLimit || intoReserve ? 'risk' : 'positive';
}
