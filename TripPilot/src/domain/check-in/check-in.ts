import type { CheckInIntent, DailyCheckIn } from '@/domain/types/common';

/**
 * E5 (M7): daily intent check-in — pure helpers.
 *
 * The check-in is a one-tap context for the day (calm / outing / night) that
 * colors tone and the day's budget framing. It is READ-ONLY signal: it never
 * writes a user's profile value (ÂNCORA 12) and it never blocks a record
 * (ÂNCORA 10). It lives as a single non-indexed field on AppSettings and is
 * scoped to one local date — a new day clears it.
 */

export interface CheckInIntentDescriptor {
  intent: CheckInIntent;
  /** Material symbol shown on the card button. */
  icon: string;
  labelKey: string;
}

/** Data-driven catalog so the UI only renders (Core Rule 8). */
export const CHECK_IN_INTENT_CATALOG: CheckInIntentDescriptor[] = [
  { intent: 'calm', icon: 'self_improvement', labelKey: 'dashboard.checkin_calm' },
  { intent: 'outing', icon: 'directions_walk', labelKey: 'dashboard.checkin_outing' },
  { intent: 'night', icon: 'nightlife', labelKey: 'dashboard.checkin_night' },
];

/**
 * The check-in's RESULT: each intent turns the SAME honest "free today" into a
 * DIFFERENT, concrete suggestion, so picking a mode visibly changes something —
 * the whole point the dead toggle was missing.
 *
 * It stays a READ-ONLY suggestion layer (ÂNCORA 12): the real free-today number
 * in the hero never moves; this only proposes how to USE it for the day:
 *  - calm   → a light spending target; the rest becomes slack for later.
 *  - outing → the full amount, balanced ("free pace").
 *  - night  → reserve part of it for the night, the rest for earlier.
 *
 * `primaryCents` is the headline number for the mode and `secondaryCents` is its
 * complement (saved / day-portion), so the two numbers always sum to free-today.
 */
export interface CheckInDayPlan {
  intent: CheckInIntent;
  icon: string;
  /** i18n key; message uses {{primary}} and (when present) {{secondary}}. */
  messageKey: string;
  /** The amount the mode suggests for "today/now" (cents, ≥ 0). */
  primaryCents: number;
  /** The complement (saved for calm / earlier-day for night), or null. */
  secondaryCents: number | null;
  /** Short label for the headline number (so the result reads as a stat). */
  primaryLabelKey: string;
  /** Short label for the complement number, or null when there is none. */
  secondaryLabelKey: string | null;
}

/** Calm aims to spend this share of the day; the rest is kept as slack. */
const CALM_SPEND_FACTOR = 0.6;
/** Night reserves this share of the day's money for the night out. */
const NIGHT_RESERVE_FACTOR = 0.5;

/**
 * Turns the day's free-to-use money into the chosen mode's concrete plan. Pure
 * and read-only — never mutates the budget (ÂNCORA 12). Negatives are clamped so
 * an already-over day yields zeros (the hero still shows the real over-budget).
 */
export function planCheckInDay(intent: CheckInIntent, freeTodayCents: number): CheckInDayPlan {
  const free = Math.max(0, Math.round(freeTodayCents));
  if (intent === 'calm') {
    const primary = Math.round(free * CALM_SPEND_FACTOR);
    return {
      intent,
      icon: 'savings',
      messageKey: 'dashboard.checkin_plan_calm',
      primaryCents: primary,
      secondaryCents: free - primary,
      primaryLabelKey: 'dashboard.checkin_stat_calm_primary',
      secondaryLabelKey: 'dashboard.checkin_stat_calm_secondary',
    };
  }
  if (intent === 'night') {
    const primary = Math.round(free * NIGHT_RESERVE_FACTOR);
    return {
      intent,
      icon: 'nightlife',
      messageKey: 'dashboard.checkin_plan_night',
      primaryCents: primary,
      secondaryCents: free - primary,
      primaryLabelKey: 'dashboard.checkin_stat_night_primary',
      secondaryLabelKey: 'dashboard.checkin_stat_night_secondary',
    };
  }
  return {
    intent,
    icon: 'directions_walk',
    messageKey: 'dashboard.checkin_plan_outing',
    primaryCents: free,
    secondaryCents: null,
    primaryLabelKey: 'dashboard.checkin_stat_outing_primary',
    secondaryLabelKey: null,
  };
}

/** The check-in only counts when it belongs to today; older ones are stale. */
export function getActiveCheckIn(
  checkIn: DailyCheckIn | null | undefined,
  todayDate: string,
): DailyCheckIn | null {
  if (!checkIn || checkIn.date !== todayDate) return null;
  return checkIn;
}

/** Builds the record persisted on AppSettings for the given day. */
export function createDailyCheckIn(intent: CheckInIntent, todayDate: string): DailyCheckIn {
  return { date: todayDate, intent };
}

/** True when the day has no active check-in yet (drives the notification). */
export function shouldPromptCheckIn(
  checkIn: DailyCheckIn | null | undefined,
  todayDate: string,
): boolean {
  return getActiveCheckIn(checkIn, todayDate) === null;
}
