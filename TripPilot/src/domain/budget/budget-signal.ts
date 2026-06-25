/**
 * C04 / DEC-304 — one shared classifier so the Copilot and the Planner speak the
 * SAME language. The recurring scare: the Copilot says "you're in control" (it
 * reads your REAL spending pace) while the Planner shows a red −318 (it reads
 * your FUTURE allocation). Both numbers are correct; the contradiction is purely
 * in the words. This pure function reconciles the COPY, never the math: it sorts
 * the situation into one of five honest cases and flags whether it is a REAL
 * money problem (the only case that deserves an alarm — DEC-299).
 *
 * The five cases:
 *  - real_over        — real spend already exceeded the budget (genuine problem).
 *  - plan_unadjusted  — real spend ok, but BOTH the future allocation and the
 *                       projection run over (the plan needs a tweak).
 *  - allocation_over  — real spend ok, but the future allocation exceeds what is
 *                       available (planning, not spending).
 *  - projection_over  — real spend ok, allocation ok, but the trend projects an
 *                       overspend at this pace (a forecast, not yet real).
 *  - on_track         — nothing is wrong.
 *
 * All inputs are non-negative integer cents (the magnitude of each overflow, 0
 * when that dimension is fine).
 */
export type BudgetSignalKind =
  | 'real_over'
  | 'plan_unadjusted'
  | 'allocation_over'
  | 'projection_over'
  | 'on_track';

export interface BudgetSignalInput {
  /** How far REAL spend is past the budget (0 when real spend is fine). */
  realSpendOverCents: number;
  /** How far the FUTURE allocation exceeds what is available (0 when fine). */
  overAllocationCents: number;
  /** How far the PROJECTION ends over budget at the current pace (0 when fine). */
  projectedOverCents: number;
}

export interface BudgetSignal {
  kind: BudgetSignalKind;
  /** True only when the user's REAL money is the problem — the only red-worthy case. */
  isRealProblem: boolean;
}

export function classifyBudgetSignal(input: BudgetSignalInput): BudgetSignal {
  const realOver = Math.max(0, Math.round(input.realSpendOverCents));
  const allocationOver = Math.max(0, Math.round(input.overAllocationCents));
  const projectionOver = Math.max(0, Math.round(input.projectedOverCents));

  if (realOver > 0) return { kind: 'real_over', isRealProblem: true };
  if (allocationOver > 0 && projectionOver > 0)
    return { kind: 'plan_unadjusted', isRealProblem: false };
  if (allocationOver > 0) return { kind: 'allocation_over', isRealProblem: false };
  if (projectionOver > 0) return { kind: 'projection_over', isRealProblem: false };
  return { kind: 'on_track', isRealProblem: false };
}
