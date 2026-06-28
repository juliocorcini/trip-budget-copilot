import type { Phase } from '@/domain/types/phase';
import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import { calculateSpentOnDate } from '@/domain/transactions';
import { getDaySpendingWeight } from '@/domain/phases';
import { calculateEventReserves } from '@/domain/budget';

/**
 * DEC-130 + DEC-136: phase burn-down — cumulative real spending vs the ideal
 * pace line. The ideal line follows the FULL plan, not a naive linear split:
 * rhythm weights (DEC-075) make peak days release more budget, and planned
 * occurrences with a date (events, sub-destinations — DEC-072) appear as
 * steps on their planned day with their reserved/estimated amount.
 */

export interface BurndownPoint {
  dayIso: string;
  /** Cumulative budget the plan "releases" up to this day (inclusive). */
  idealCents: number;
  /** Cumulative real spending; null for days after today (future). */
  actualCents: number | null;
}

export interface PhaseBurndown {
  points: BurndownPoint[];
  budgetCents: number;
  spentToDateCents: number;
  idealToDateCents: number;
  /** spent − ideal: positive = above the planned pace. */
  deltaCents: number;
  abovePace: boolean;
  /** Index of "today" in points (last point when the phase already ended). */
  todayIndex: number;
}

export interface BuildPhaseBurndownInput {
  phase: Phase;
  /**
   * Current free-to-spend + what was already spent. Reserves of PENDING
   * events are NOT in here (free-to-spend already deducted them) — they are
   * added back so the chart shows the full phase envelope.
   */
  phaseBudgetCents: number;
  /** Pool-scoped transactions (same set the hero math uses). */
  transactions: Transaction[];
  todayIso: string;
  /** Pool-scoped planned occurrences; dated ones become ideal-line steps. */
  occurrences: PlannedOccurrence[];
}

const MAX_PHASE_DAYS = 92;

function listPhaseDays(phase: Phase): string[] {
  const days: string[] = [];
  const cursor = new Date(`${phase.startDate.slice(0, 10)}T12:00:00`);
  const end = new Date(`${phase.endDate.slice(0, 10)}T12:00:00`);
  while (cursor <= end && days.length < MAX_PHASE_DAYS) {
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    days.push(`${cursor.getFullYear()}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * DEC-136: planned money with a known date is "released" on that exact day,
 * not diluted across the phase. Multi-day occurrences spread their amount
 * evenly over the planned interval (clamped to the phase).
 */
function buildEventStepsByDay(
  occurrences: PlannedOccurrence[],
  phase: Phase,
  days: string[],
): Map<string, number> {
  const steps = new Map<string, number>();
  for (const occ of occurrences) {
    if (occ.deletedAt !== null || occ.phaseId !== phase.id) continue;
    if (occ.plannedDate === null) continue;
    const stepCents = occ.reservedCents ?? occ.estimatedCostCents;
    if (stepCents <= 0) continue;

    const start = occ.plannedDate.slice(0, 10);
    const end = (occ.endDate ?? occ.plannedDate).slice(0, 10);
    const span = days.filter((day) => day >= start && day <= end);
    if (span.length === 0) continue;

    const perDay = Math.floor(stepCents / span.length);
    span.forEach((day, i) => {
      const amount = i === span.length - 1 ? stepCents - perDay * (span.length - 1) : perDay;
      steps.set(day, (steps.get(day) ?? 0) + amount);
    });
  }
  return steps;
}

export function buildPhaseBurndown(input: BuildPhaseBurndownInput): PhaseBurndown | null {
  const days = listPhaseDays(input.phase);
  if (days.length < 2) return null;
  const firstDay = days[0]!;
  if (input.todayIso < firstDay) return null;

  // Pending reserves were deducted from free-to-spend; the chart envelope
  // adds back what is STILL reserved (DEC-385 consumable remainder) so the ideal
  // line can release it on the planned days without re-counting consumed spend.
  const pendingReserveCents = calculateEventReserves(
    input.occurrences,
    input.phase.id,
    input.transactions,
  );
  const chartBudgetCents = input.phaseBudgetCents + pendingReserveCents;
  if (chartBudgetCents <= 0) return null;

  const weights = days.map((day) => getDaySpendingWeight(input.phase, day));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return null;

  const stepsByDay = buildEventStepsByDay(input.occurrences, input.phase, days);
  let stepTotalCents = 0;
  stepsByDay.forEach((cents) => {
    stepTotalCents += cents;
  });
  // Whatever is not tied to a dated occurrence follows the daily rhythm.
  const dailyBudgetCents = Math.max(0, chartBudgetCents - stepTotalCents);

  let runningWeight = 0;
  let runningStepCents = 0;
  let runningSpentCents = 0;
  let todayIndex = days.length - 1;

  const points: BurndownPoint[] = days.map((dayIso, i) => {
    runningWeight += weights[i]!;
    runningStepCents += stepsByDay.get(dayIso) ?? 0;
    const idealCents =
      Math.round((dailyBudgetCents * runningWeight) / totalWeight) + runningStepCents;

    if (dayIso > input.todayIso) {
      return { dayIso, idealCents, actualCents: null };
    }
    if (dayIso === input.todayIso) todayIndex = i;
    runningSpentCents += calculateSpentOnDate(input.transactions, dayIso);
    return { dayIso, idealCents, actualCents: runningSpentCents };
  });

  const todayPoint = points[todayIndex]!;
  const spentToDateCents = todayPoint.actualCents ?? runningSpentCents;
  const idealToDateCents = todayPoint.idealCents;
  const deltaCents = spentToDateCents - idealToDateCents;

  return {
    points,
    budgetCents: dailyBudgetCents + stepTotalCents,
    spentToDateCents,
    idealToDateCents,
    deltaCents,
    abovePace: deltaCents > 0,
    todayIndex,
  };
}
