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
      /** DEC-115 (R-06): done > planned NEVER reads as "within plan". */
      kind: 'over_plan';
      profileId: string;
      profileName: string;
      plannedQuantity: number;
      doneQuantity: number;
      reserveStartDate: string | null;
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
      // G6: reconcile the CATEGORY limit with the PHASE slack. The category plan
      // can be tight ("only 3 of 4 fit") while the phase still has room — which
      // read as a contradiction. These let the card say both truths honestly.
      /** Occasions beyond the category budget (remainingPlanned − fitCount, ≥ 1). */
      overflowCount: number;
      /** Phase free margin after the triggering spend (the "folga", ≥ 0). */
      phaseFreeCents: number;
      /** True when that slack covers every overflow occasion → they fit, guilt-free. */
      overflowFitsPhase: boolean;
    }
  | {
      kind: 'no_plan';
      profileId: string;
      profileName: string;
      /** Honest fallback: % of the phase free margin this spend consumed. */
      impactPercent: number;
    };

/**
 * FIELD R2 item 21 (F21): the honest-friend tone, so the card is colored by
 * MEANING instead of always reading as the orange "alert" accent. The reserve
 * date (the pace will start eating the protected reserve) is the strongest
 * signal, so a `kind` that projects one escalates to `alert`.
 *  - positive → within plan (genuinely on track — green)
 *  - steady   → over the category pace, but the phase slack absorbs the overflow
 *               (D-BUG-11 / D-DEC-E: a calm "heads up, but you're fine" — blue/teal,
 *               NOT green, because the message still says "only N of M fit")
 *  - caution  → over the category pace / over the plan, reserve still safe (amber)
 *  - alert    → over plan/pace AND the pace projects into the protected reserve (red)
 *  - neutral  → no plan for the category (informational impact %, nothing to alarm)
 */
export type HonestFriendTone = 'positive' | 'steady' | 'caution' | 'alert' | 'neutral';

export function getHonestFriendTone(amigo: HonestFriendV2): HonestFriendTone {
  switch (amigo.kind) {
    case 'on_plan':
      return 'positive';
    case 'over_pace':
      // D-BUG-11: the slack covers the overflow, but the card still tells the
      // user "only N of the M left fit" — a green light contradicts that copy.
      // `steady` keeps it reassuring without pretending everything is on plan.
      if (amigo.overflowFitsPhase) return 'steady';
      return amigo.reserveStartDate !== null ? 'alert' : 'caution';
    case 'over_plan':
      return amigo.reserveStartDate !== null ? 'alert' : 'caution';
    case 'no_plan':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * E2 (M12): "borrow from tomorrow" — an honest warning, never a block
 * (DEC-053). Triggered when a spend overflows TODAY's allowance but still
 * fits the phase's free-to-spend: the money has to come from another day.
 * A spend that overflows the whole phase is a real overspend (handled by the
 * simulator's exceeds-free path), so it is NOT a borrow situation here.
 */
export type BorrowFromTomorrow =
  | { kind: 'none' }
  | {
      kind: 'borrow_tomorrow';
      /** How much today goes negative (amount − today's allowance). */
      todayNegativeCents: number;
      /** Phase free margin left after the spend. */
      remainingAfterCents: number;
    };

export function evaluateBorrowFromTomorrow(
  amountCents: number,
  todayAllowanceCents: number | null,
  freeToSpendCents: number,
): BorrowFromTomorrow {
  if (amountCents <= 0 || todayAllowanceCents === null) return { kind: 'none' };
  // Fits today → nothing to borrow.
  if (amountCents <= todayAllowanceCents) return { kind: 'none' };
  // Overflows the whole phase → real overspend, not a borrow.
  if (amountCents > freeToSpendCents) return { kind: 'none' };
  return {
    kind: 'borrow_tomorrow',
    todayNegativeCents: amountCents - todayAllowanceCents,
    remainingAfterCents: freeToSpendCents - amountCents,
  };
}

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
    // DEC-115 (R-06): "20 of 5 — within plan" is impossible. Used more
    // occasions than planned → say it plainly.
    if (input.doneQuantity > input.plannedQuantity) {
      return {
        kind: 'over_plan',
        profileId: input.profileId,
        profileName: input.profileName,
        plannedQuantity: input.plannedQuantity,
        doneQuantity: input.doneQuantity,
        reserveStartDate: projectReserveStartDate(
          input.phase,
          input.todayDate,
          input.phaseSpentCents,
          input.phaseBudgetCents,
        ),
      };
    }

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

    // G6: the occasions the CATEGORY budget can't absorb, and whether the
    // PHASE free margin (folga) can — so the card never reads as a contradiction
    // ("only 3 fit" vs "you're under budget"). Both are true; we say so.
    const overflowCount = remainingPlanned - fitCount;
    const phaseFreeCents = Math.max(0, input.freeToSpendCents);
    const overflowFitsPhase =
      phaseFreeCents > 0 && phaseFreeCents >= overflowCount * input.typicalValueCents;

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
      overflowCount,
      phaseFreeCents,
      overflowFitsPhase,
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
