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
