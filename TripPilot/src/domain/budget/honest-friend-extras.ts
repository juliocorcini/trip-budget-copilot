import type { HonestFriendTone } from './honest-friend';

/**
 * DEC-093 follow-up (device-test 2026-06-20): the Amigo Sincero used to surface a
 * SINGLE verdict and got "stuck" on it ("esse gasto levou 1% do dinheiro livre")
 * even when there was clearly more to say. These pure EXTRAS turn the card into a
 * carousel: the rich verdict stays slide 0, and each qualifying extra below adds
 * one more honest, data-grounded slide. Each extra is a small typed record the
 * card renders (currency formatting stays in the card, so the domain is pure and
 * currency-agnostic). Only meaningful extras are returned — nothing to pad.
 */
export type HonestFriendExtra =
  | { id: 'phase_progress'; tone: HonestFriendTone; percent: number }
  | { id: 'daily_left'; tone: HonestFriendTone; days: number; perDayCents: number }
  | { id: 'top_category'; tone: HonestFriendTone; categoryKey: string; amountCents: number; percent: number }
  | { id: 'receivable'; tone: HonestFriendTone; amountCents: number };

export interface HonestFriendExtrasInput {
  /** Cents spent in the phase so far (personal cost). */
  phaseSpentCents: number;
  /** The phase budget envelope (spent + free), in cents. */
  phaseBudgetCents: number;
  /** Free-to-spend left in the phase, clamped at ≥ 0. */
  freeToSpendCents: number;
  /** Whole days left until the phase ends (≥ 0). */
  daysLeftInPhase: number;
  /** The category with the most spend this phase, or null when there is none. */
  topCategoryKey: string | null;
  /** Cents spent on that top category. */
  topCategoryCents: number;
  /** Money others owe the user (settle-up receivable), in cents. */
  receivableCents: number;
}

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

/**
 * Builds the ordered list of extra insights for the Amigo Sincero carousel. Each
 * is gated on being genuinely informative (positive amounts, a real plan window),
 * so an empty trip yields an empty list and the card just shows its verdict.
 */
export function buildHonestFriendExtras(input: HonestFriendExtrasInput): HonestFriendExtra[] {
  const extras: HonestFriendExtra[] = [];

  if (input.phaseBudgetCents > 0 && input.phaseSpentCents > 0) {
    const percent = clampPercent((input.phaseSpentCents / input.phaseBudgetCents) * 100);
    extras.push({ id: 'phase_progress', tone: percent >= 90 ? 'caution' : 'neutral', percent });
  }

  if (input.daysLeftInPhase > 0 && input.freeToSpendCents > 0) {
    const perDayCents = Math.floor(input.freeToSpendCents / input.daysLeftInPhase);
    if (perDayCents > 0) {
      extras.push({ id: 'daily_left', tone: 'neutral', days: input.daysLeftInPhase, perDayCents });
    }
  }

  if (input.topCategoryKey && input.topCategoryCents > 0 && input.phaseSpentCents > 0) {
    const percent = clampPercent((input.topCategoryCents / input.phaseSpentCents) * 100);
    extras.push({
      id: 'top_category',
      tone: 'neutral',
      categoryKey: input.topCategoryKey,
      amountCents: input.topCategoryCents,
      percent,
    });
  }

  if (input.receivableCents > 0) {
    extras.push({ id: 'receivable', tone: 'positive', amountCents: input.receivableCents });
  }

  return extras;
}
