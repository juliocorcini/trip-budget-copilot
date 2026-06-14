import type { Coords } from '@/domain/location';

/**
 * E8 (M4): the "nearby place name" boundary. Isolated so the domain stays pure
 * and offline-first (ÂNCORA 10): this is the ONLY place that touches the network
 * for locations, it is OPT-IN (the traveler taps "find name"), online-only, and
 * NEVER throws or blocks — it resolves null on offline/timeout/error so the
 * manual name + history fallback always works. Coordinates are sent for this one
 * explicit lookup only; raw GPS storage stays 100% local (ÂNCORA 8).
 */

export interface PlaceResult {
  label: string;
  placeId: string | null;
}

// OpenStreetMap Nominatim reverse geocoder (free, public, attribution: © OSM).
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

/** Best-effort connectivity check. Defaults to "online" when unknown. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/**
 * Resolves a concise, human-readable name for a coordinate (e.g. a venue or
 * street + city). Returns null on offline, timeout, HTTP error, or unparsable
 * payload — callers fall back to the manual name / recent places.
 */
export async function reverseGeocodePlace(
  coords: Coords,
  timeoutMs = 6000,
): Promise<PlaceResult | null> {
  if (!isOnline() || typeof fetch === 'undefined') return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const url =
      `${NOMINATIM_REVERSE_URL}?format=jsonv2&zoom=18&addressdetails=1` +
      `&lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lng))}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    const label = extractLabel(data);
    if (!label) return null;

    const rawId = data['place_id'];
    const placeId = rawId == null ? null : String(rawId);
    return { label, placeId };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Picks the most specific concise label from a Nominatim reverse response. */
function extractLabel(data: Record<string, unknown>): string | null {
  const name = readString(data, 'name');
  if (name) return name;

  const rawAddress = data['address'];
  if (rawAddress && typeof rawAddress === 'object') {
    const address = rawAddress as Record<string, unknown>;
    const primary =
      readString(address, 'amenity') ??
      readString(address, 'shop') ??
      readString(address, 'tourism') ??
      readString(address, 'building') ??
      readString(address, 'road') ??
      readString(address, 'neighbourhood') ??
      readString(address, 'suburb');
    const locality =
      readString(address, 'city') ??
      readString(address, 'town') ??
      readString(address, 'village') ??
      readString(address, 'municipality');
    const parts = [primary, locality].filter((part): part is string => part !== null);
    if (parts.length > 0) return parts.join(', ');
  }

  const displayName = readString(data, 'display_name');
  if (displayName) return displayName.split(',')[0]!.trim();

  return null;
}
