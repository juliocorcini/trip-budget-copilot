import type { CurrentPlace } from '@/domain/types/common';

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
