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
