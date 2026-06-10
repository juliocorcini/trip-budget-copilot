import type { Phase } from '@/domain/types/phase';
import { calculateEffectiveSpendingDays } from '@/domain/phases';

/**
 * DEC-093 (R-11): Honest Friend v2 — grounded on the PLAN, never on
 * "remaining balance ÷ typical cost" (which produced absurd counts like
 * "197 bar nights"). The card compares planned occasions with what still
 * fits in the category budget and projects WHEN the reserve starts being
 * used if the current pace continues.
 */

export interface HonestFriendV2Input {
  profileId: string;
  profileName: string;
  typicalValueCents: number;
  /** Planned occasions from the active ScenarioPlan (0 = no plan). */
  plannedQuantity: number;
  /** Occasions already done in the phase (forecast engine). */
  doneQuantity: number;
  /** Cents spent on this profile in the phase. */
  categorySpentCents: number;
  /** The spend that triggered the card. */
  recentSpendCents: number;
  freeToSpendCents: number;
  phaseSpentCents: number;
  phaseBudgetCents: number;
  todayDate: string;
  phase: Phase;
}

export type HonestFriendV2 =
  | { kind: 'none' }
  | {
      kind: 'on_plan';
      profileId: string;
      profileName: string;
      plannedQuantity: number;
      doneQuantity: number;
      remainingPlanned: number;
    }
  | {
      kind: 'over_pace';
      profileId: string;
      profileName: string;
      plannedQuantity: number;
      doneQuantity: number;
      remainingPlanned: number;
      /** How many of the remaining planned occasions still fit the budget. */
      fitCount: number;
      /** Estimated date the protected reserve starts being used (or null). */
      reserveStartDate: string | null;
    }
  | {
      kind: 'no_plan';
      profileId: string;
      profileName: string;
      /** Honest fallback: % of the phase free margin this spend consumed. */
      impactPercent: number;
    };

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextDay(dateIso: string): string {
  return addDays(dateIso, 1);
}

/**
 * DEC-093: at the current pace, the date the phase budget runs out and the
 * protected reserve starts being used. Null when the pace never reaches it
 * before the phase ends (reserve safe).
 */
export function projectReserveStartDate(
  phase: Phase,
  todayDate: string,
  phaseSpentCents: number,
  phaseBudgetCents: number,
): string | null {
  if (phaseSpentCents <= 0) return null;
  if (phaseSpentCents >= phaseBudgetCents) return todayDate;

  const totalEffective = calculateEffectiveSpendingDays(phase, phase.startDate);
  const remainingEffective = calculateEffectiveSpendingDays(phase, nextDay(todayDate));
  const elapsedEffective = Math.max(0.1, totalEffective - remainingEffective);

  const perDayCents = phaseSpentCents / elapsedEffective;
  if (perDayCents <= 0) return null;

  const remainingBudgetCents = phaseBudgetCents - phaseSpentCents;
  const daysUntil = Math.ceil(remainingBudgetCents / perDayCents);

  const date = addDays(todayDate, daysUntil);
  return date > phase.endDate ? null : date;
}

export function buildHonestFriendV2(input: HonestFriendV2Input): HonestFriendV2 {
  if (input.recentSpendCents <= 0 || input.typicalValueCents <= 0) {
    return { kind: 'none' };
  }

  if (input.plannedQuantity > 0) {
    const remainingPlanned = Math.max(0, input.plannedQuantity - input.doneQuantity);
    const categoryBudgetCents = input.plannedQuantity * input.typicalValueCents;
    const categoryRemainingCents = categoryBudgetCents - input.categorySpentCents;
    const fitCount = Math.min(
      remainingPlanned,
      Math.max(0, Math.floor(categoryRemainingCents / input.typicalValueCents)),
    );

    if (remainingPlanned === 0 || fitCount >= remainingPlanned) {
      return {
        kind: 'on_plan',
        profileId: input.profileId,
        profileName: input.profileName,
        plannedQuantity: input.plannedQuantity,
        doneQuantity: input.doneQuantity,
        remainingPlanned,
      };
    }

    return {
      kind: 'over_pace',
      profileId: input.profileId,
      profileName: input.profileName,
      plannedQuantity: input.plannedQuantity,
      doneQuantity: input.doneQuantity,
      remainingPlanned,
      fitCount,
      reserveStartDate: projectReserveStartDate(
        input.phase,
        input.todayDate,
        input.phaseSpentCents,
        input.phaseBudgetCents,
      ),
    };
  }

  // No plan for the category: honest fallback — impact on the phase free
  // margin, NEVER an occasion count.
  const freeBeforeCents = input.freeToSpendCents + input.recentSpendCents;
  const impactPercent =
    freeBeforeCents <= 0
      ? 100
      : Math.min(100, Math.round((input.recentSpendCents / freeBeforeCents) * 100));

  return {
    kind: 'no_plan',
    profileId: input.profileId,
    profileName: input.profileName,
    impactPercent,
  };
}
