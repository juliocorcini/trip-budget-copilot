/**
 * E6 (Phase 4) — motivation layer: savings goal + piggy bank.
 *
 * ÂNCORA 11 / DEC-088: both are READ-ONLY derivations of under-spending. They
 * are NEVER a real pool and NEVER feed `calculateFreeToSpend` — the "free
 * today" math is byte-identical whether or not these are displayed. All money
 * is integer cents (ÂNCORA 15).
 */

export interface ProjectTripEndSurplusInput {
  totalBudgetCents: number;
  totalSpentCents: number;
  daysElapsed: number;
  daysRemaining: number;
}

/**
 * M14: projected money left at the end of the trip — linear extrapolation of
 * the current daily pace over the days that remain. Can be negative when the
 * pace projects an overspend.
 */
export function projectTripEndSurplus(input: ProjectTripEndSurplusInput): number {
  const avgDailyCents = input.totalSpentCents / Math.max(1, input.daysElapsed);
  const projectedSpendCents = input.totalSpentCents + Math.round(avgDailyCents * input.daysRemaining);
  return input.totalBudgetCents - projectedSpendCents;
}

export interface SavingsGoalProgressInput {
  goalCents: number;
  projectedSurplusCents: number;
}

export interface SavingsGoalProgress {
  goalCents: number;
  projectedSurplusCents: number;
  /** 0..1, clamped — drives the progress bar. */
  progressRatio: number;
  /** projected surplus minus goal: positive = ahead, negative = behind. */
  gapCents: number;
  onTrack: boolean;
}

/**
 * M14: how the projected surplus tracks against the user's savings goal
 * ("come back with €200 to spare"). Pure presentation math.
 */
export function calculateSavingsGoalProgress(
  input: SavingsGoalProgressInput,
): SavingsGoalProgress {
  const ratio =
    input.goalCents <= 0
      ? 1
      : Math.max(0, Math.min(1, input.projectedSurplusCents / input.goalCents));
  return {
    goalCents: input.goalCents,
    projectedSurplusCents: input.projectedSurplusCents,
    progressRatio: ratio,
    gapCents: input.projectedSurplusCents - input.goalCents,
    onTrack: input.projectedSurplusCents >= input.goalCents,
  };
}

export interface PiggyBankInput {
  totalBudgetCents: number;
  totalSpentCents: number;
  daysElapsed: number;
  totalDays: number;
}

/**
 * M15: the "piggy bank" — money saved by spending below the linear pace so far.
 * Cumulative under-spend = ideal-to-date − actual-to-date, never negative.
 * Purely derived; does not touch the budget (ÂNCORA 11).
 */
export function calculatePiggyBank(input: PiggyBankInput): number {
  if (input.totalDays <= 0 || input.daysElapsed <= 0) return 0;
  const elapsedFraction = Math.min(1, input.daysElapsed / input.totalDays);
  const idealToDateCents = Math.round(input.totalBudgetCents * elapsedFraction);
  return Math.max(0, idealToDateCents - input.totalSpentCents);
}
