import type { CurrentPlace } from '@/domain/types/common';
import type { Transaction } from '@/domain/types/transaction';

export interface Coords {
  lat: number;
  lng: number;
}

export interface TransactionPlaceFields {
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
}

/**
 * E8 (M4): a place reused from history — derived purely from past expenses so
 * the traveler can re-tag a known venue offline, without any network.
 */
export interface RecentPlace {
  label: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  /** ISO timestamp of the most recent expense at this place. */
  lastUsedAt: string;
  /** How many expenses were logged here. */
  count: number;
  /** Distance to the current position, when both are known (else null). */
  distanceMeters: number | null;
}

/** E8 (M7): the spend total for one place ("gastos por lugar"). */
export interface PlaceTotal {
  label: string;
  placeId: string | null;
  totalCents: number;
  count: number;
}

/**
 * E8 (M3): how far the traveler must move before TripPilot re-asks for the
 * place. Keeps the location "sticky" within the same venue/block while still
 * noticing a real move to another area.
 */
export const DEFAULT_REASK_THRESHOLD_METERS = 150;

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two coordinates, in meters (haversine). Pure
 * and offline — coordinates never leave the device (ÂNCORA 8).
 */
export function haversineMeters(a: Coords, b: Coords): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * M3: whether to re-ask the place for a new GPS reading. true when there is no
 * remembered place yet, or the traveler moved beyond the threshold — otherwise
 * the current place is inherited without asking.
 */
export function shouldReaskPlace(
  current: CurrentPlace | null,
  newCoords: Coords,
  thresholdMeters: number = DEFAULT_REASK_THRESHOLD_METERS,
): boolean {
  if (!current) return true;
  // M4: a manually named place (no coordinates) is intentional — keep it
  // instead of letting a GPS reading overwrite the chosen name.
  if (current.lat === null || current.lng === null) return false;
  return (
    haversineMeters({ lat: current.lat, lng: current.lng }, newCoords) > thresholdMeters
  );
}

/** A neutral coordinate label used until a real name is set (M4 names it). */
export function coordsLabel(coords: Coords): string {
  return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
}

/** Maps a sticky CurrentPlace to the transaction's location fields. */
export function placeToTransactionFields(place: CurrentPlace | null): TransactionPlaceFields {
  if (!place) {
    return { placeLabel: null, latitude: null, longitude: null, placeId: null };
  }
  return {
    placeLabel: place.label,
    latitude: place.lat,
    longitude: place.lng,
    placeId: place.placeId,
  };
}

/** Structural equality for two places (used to avoid redundant settings writes). */
export function placesEqual(a: CurrentPlace | null, b: CurrentPlace | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.label === b.label &&
    a.lat === b.lat &&
    a.lng === b.lng &&
    a.placeId === b.placeId
  );
}

/** Turns a remembered/derived place into the sticky CurrentPlace shape. */
export function toCurrentPlace(place: {
  label: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
}): CurrentPlace {
  return { label: place.label, lat: place.lat, lng: place.lng, placeId: place.placeId };
}

/** Whether a transaction carries a usable place label. */
function hasPlace(t: Transaction): boolean {
  return t.type === 'expense' && t.deletedAt === null && (t.placeLabel ?? '').trim() !== '';
}

/** Group key: prefer a stable provider id, fall back to the (trimmed) label. */
function placeKey(placeId: string | null, label: string): string {
  return placeId ?? label.trim();
}

/**
 * E8 (M4): the places used recently, derived purely from past expenses (offline,
 * no network). When the current coordinates are known, the list is ordered by
 * proximity (nearest first); otherwise by most-recent use. Lets the traveler
 * re-tag a known venue with one tap even with GPS off.
 */
export function deriveRecentPlaces(
  transactions: Transaction[],
  currentCoords: Coords | null = null,
  limit = 6,
): RecentPlace[] {
  const groups = new Map<string, RecentPlace>();

  for (const t of transactions) {
    if (!hasPlace(t)) continue;
    const label = t.placeLabel!.trim();
    const key = placeKey(t.placeId, label);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        label,
        lat: t.latitude,
        lng: t.longitude,
        placeId: t.placeId,
        lastUsedAt: t.date,
        count: 1,
        distanceMeters: null,
      });
      continue;
    }

    existing.count += 1;
    if (t.date > existing.lastUsedAt) {
      existing.lastUsedAt = t.date;
      existing.label = label;
    }
    // Keep the freshest known coordinates for this place.
    if (existing.lat === null && t.latitude !== null && t.longitude !== null) {
      existing.lat = t.latitude;
      existing.lng = t.longitude;
    }
  }

  const list = [...groups.values()];

  if (currentCoords) {
    for (const place of list) {
      if (place.lat !== null && place.lng !== null) {
        place.distanceMeters = haversineMeters(currentCoords, { lat: place.lat, lng: place.lng });
      }
    }
    list.sort((a, b) => {
      if (a.distanceMeters === null && b.distanceMeters === null) {
        return b.lastUsedAt.localeCompare(a.lastUsedAt);
      }
      if (a.distanceMeters === null) return 1;
      if (b.distanceMeters === null) return -1;
      return a.distanceMeters - b.distanceMeters;
    });
  } else {
    list.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  }

  return list.slice(0, limit);
}

/**
 * E8 (M7): total spend grouped by place ("gastos por lugar"), sorted by the
 * highest spend. Uses the transaction amount (same basis as the expense list
 * total) and ignores deleted/non-expense rows.
 */
export function aggregateByPlace(transactions: Transaction[]): PlaceTotal[] {
  const groups = new Map<string, PlaceTotal>();

  for (const t of transactions) {
    if (!hasPlace(t)) continue;
    const label = t.placeLabel!.trim();
    const key = placeKey(t.placeId, label);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, { label, placeId: t.placeId, totalCents: t.amountCents, count: 1 });
    } else {
      existing.totalCents += t.amountCents;
      existing.count += 1;
    }
  }

  return [...groups.values()].sort((a, b) => b.totalCents - a.totalCents);
}
