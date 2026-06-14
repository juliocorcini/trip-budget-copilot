import type { CheckInIntent } from '@/domain/types/common';
import type { DashboardCardId } from '@/domain/dashboard';

/**
 * E5 — "lens of the day". The chosen check-in mode does not only relabel its own
 * card: it brings ONE other dashboard signal into focus, so picking a mode
 * visibly reshapes the home screen (the missing payoff of the once-dead toggle).
 *
 * This is pure framing — READ-ONLY (ÂNCORA 12). Nothing here touches the budget;
 * it only decides which already-present card the day's intent should spotlight:
 *  - calm   → the piggy bank (what the trip is quietly saving).
 *  - outing → the occasion counters (how many occasions are still planned).
 *  - night  → no card focus; the night reserve projects into "≈ rounds" instead,
 *             shown inline on the check-in card itself.
 */
export interface CheckInLens {
  intent: CheckInIntent;
  /** Dashboard card the mode spotlights, or null when the focus is in-card. */
  focusCardId: DashboardCardId | null;
}

const LENS_BY_INTENT: Record<CheckInIntent, CheckInLens> = {
  calm: { intent: 'calm', focusCardId: 'piggy_bank' },
  outing: { intent: 'outing', focusCardId: 'occasion_counters' },
  night: { intent: 'night', focusCardId: null },
};

/** Data-driven lookup so the UI only renders (Core Rule 8). */
export function getCheckInLens(intent: CheckInIntent): CheckInLens {
  return LENS_BY_INTENT[intent];
}

/**
 * Night projection: how many "rounds" the night reserve buys at the average
 * round price. Returns null when there is no usable price or reserve, so the UI
 * simply omits the line (it never shows "≈ 0 rounds" as if it were a plan).
 */
export function estimateNightRounds(
  reserveCents: number,
  avgRoundCents: number | null,
): number | null {
  if (avgRoundCents === null || avgRoundCents <= 0) return null;
  if (reserveCents <= 0) return null;
  const rounds = Math.floor(reserveCents / avgRoundCents);
  // Below one full round we omit the line entirely (never "≈ 0 rounds").
  return rounds >= 1 ? rounds : null;
}

/**
 * The average price of a "round", taken from the traveler's OWN profiles (a
 * bar/night profile's configured drink price). Pure — prefers a bar/night
 * profile, then the cheapest configured round, else null when none is set.
 */
export function deriveAvgRoundCents(
  profiles: Array<{ category: string; defaultAvgDrinkPriceCents: number | null }>,
): number | null {
  const priced = profiles
    .filter((p) => p.defaultAvgDrinkPriceCents !== null && p.defaultAvgDrinkPriceCents > 0)
    .map((p) => ({ category: p.category, cents: p.defaultAvgDrinkPriceCents as number }));
  if (priced.length === 0) return null;
  const barLike = priced.find((p) => p.category === 'bar' || p.category === 'night');
  if (barLike) return barLike.cents;
  return priced.reduce((min, p) => (p.cents < min ? p.cents : min), priced[0]!.cents);
}
