import type { Phase } from '@/domain/types/phase';
import type { Transaction } from '@/domain/types/transaction';
import { calculateSpentOnDate } from '@/domain/transactions';
import { getDaySpendingWeight } from '@/domain/phases';

/**
 * DEC-130: phase burn-down — cumulative real spending vs the ideal pace
 * line. The ideal line follows the phase RHYTHM weights (DEC-075), not a
 * naive linear split, so peak days legitimately allow steeper spending.
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
  /** Full phase envelope: current free-to-spend + what was already spent. */
  phaseBudgetCents: number;
  /** Pool-scoped transactions (same set the hero math uses). */
  transactions: Transaction[];
  todayIso: string;
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

export function buildPhaseBurndown(input: BuildPhaseBurndownInput): PhaseBurndown | null {
  if (input.phaseBudgetCents <= 0) return null;
  const days = listPhaseDays(input.phase);
  if (days.length < 2) return null;
  const firstDay = days[0]!;
  if (input.todayIso < firstDay) return null;

  const weights = days.map((day) => getDaySpendingWeight(input.phase, day));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return null;

  let runningWeight = 0;
  let runningSpentCents = 0;
  let todayIndex = days.length - 1;

  const points: BurndownPoint[] = days.map((dayIso, i) => {
    runningWeight += weights[i]!;
    const idealCents = Math.round((input.phaseBudgetCents * runningWeight) / totalWeight);

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
    budgetCents: input.phaseBudgetCents,
    spentToDateCents,
    idealToDateCents,
    deltaCents,
    abovePace: deltaCents > 0,
    todayIndex,
  };
}
