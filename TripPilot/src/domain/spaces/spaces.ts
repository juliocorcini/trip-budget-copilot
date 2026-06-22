import type { Trip } from '@/domain/types/trip';
import type { TripKind } from '@/domain/types/common';

/**
 * DEC-249/250 — pure logic for the multi-space switcher. A "space" is just a
 * `Trip`; the switcher groups every non-deleted space so the user can see the
 * dated trips by status and the continuous "Dia a dia" spaces side by side, and
 * swap the `activeTrip` pointer between them. No DB access lives here.
 */

export type SpaceGroupId = 'ongoing' | 'active' | 'planning' | 'completed';

export interface SpaceGroup {
  id: SpaceGroupId;
  spaces: Trip[];
}

/** DEC-250: a record predating the `kind` field is a regular dated trip. */
export function tripKind(trip: Trip): TripKind {
  return trip.kind ?? 'trip';
}

export function isOngoing(trip: Trip): boolean {
  return tripKind(trip) === 'ongoing';
}

/** Most recently touched space first — the natural "what I'm using" order. */
function byUpdatedDesc(a: Trip, b: Trip): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

// Dated trips are shown active → planning → completed; "Dia a dia" sits on top
// because it has no dates to order it among the trips.
const TRIP_STATUS_ORDER: Exclude<SpaceGroupId, 'ongoing'>[] = [
  'active',
  'planning',
  'completed',
];

/**
 * Split non-deleted spaces into ordered, non-empty groups for the switcher:
 * continuous "Dia a dia" first, then dated trips by status. Ongoing spaces are
 * never mixed into the trip-status groups even though they also carry a status.
 */
export function groupSpaces(trips: Trip[]): SpaceGroup[] {
  const live = trips.filter((t) => t.deletedAt === null);
  const groups: SpaceGroup[] = [];

  const ongoing = live.filter(isOngoing).sort(byUpdatedDesc);
  if (ongoing.length > 0) groups.push({ id: 'ongoing', spaces: ongoing });

  for (const status of TRIP_STATUS_ORDER) {
    const inStatus = live
      .filter((t) => !isOngoing(t) && t.status === status)
      .sort(byUpdatedDesc);
    if (inStatus.length > 0) groups.push({ id: status, spaces: inStatus });
  }

  return groups;
}

/** Total switchable spaces (non-deleted). Drives "show the switcher hint". */
export function countSpaces(trips: Trip[]): number {
  return trips.filter((t) => t.deletedAt === null).length;
}

/**
 * DEC-251 — capability gate. Date-coupled features (countdown to a trip end,
 * phases, a per-day allowance) only make sense for a dated Viagem. A continuous
 * "Dia a dia" has none of those and instead reasons per calendar month. The map
 * is data-driven so the UI gates by reading flags, never by re-deriving `kind`.
 */
export interface SpaceCapabilities {
  /** Trip has a meaningful end → countdown, days-left, end-of-trip projection. */
  hasEndDate: boolean;
  /** Trip is split into phases → phase header, phase budget, burndown. */
  hasPhases: boolean;
  /** Budget is spread over days → a per-day allowance ("free today"). */
  hasDailyBudget: boolean;
  /** Budget resets each calendar month → optional monthly cap (Dia a dia). */
  hasMonthlyBudget: boolean;
}

const TRIP_CAPABILITIES: SpaceCapabilities = {
  hasEndDate: true,
  hasPhases: true,
  hasDailyBudget: true,
  hasMonthlyBudget: false,
};

const ONGOING_CAPABILITIES: SpaceCapabilities = {
  hasEndDate: false,
  hasPhases: false,
  hasDailyBudget: false,
  hasMonthlyBudget: true,
};

export function spaceCapabilities(trip: Trip): SpaceCapabilities {
  return isOngoing(trip) ? ONGOING_CAPABILITIES : TRIP_CAPABILITIES;
}

/**
 * DEC-251 (os-budget): the state of a Dia a dia's OPTIONAL monthly cap against
 * the month-to-date spend. A cap of 0 means "no limit, just log" — then there
 * is nothing to be over and the bar stays empty. Pure (no dates, no I/O): the
 * caller supplies the month-scoped spend, so the same math drives the headline
 * and the progress bar and is fully unit-testable.
 */
export interface MonthlyCapStatus {
  hasCap: boolean;
  /** cap − spent; negative once the cap is blown. 0 when there is no cap. */
  remainingCents: number;
  isOver: boolean;
  /** Spend as a 0–100 clamped percentage of the cap; 0 when there is no cap. */
  pct: number;
}

export function monthlyCapStatus(spentCents: number, capCents: number): MonthlyCapStatus {
  const hasCap = capCents > 0;
  if (!hasCap) return { hasCap: false, remainingCents: 0, isOver: false, pct: 0 };
  const remainingCents = capCents - spentCents;
  return {
    hasCap: true,
    remainingCents,
    isOver: remainingCents < 0,
    pct: Math.min(100, Math.max(0, Math.round((spentCents / capCents) * 100))),
  };
}
