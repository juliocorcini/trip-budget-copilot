import type { Coords, NearbyPlace } from '@/domain/location';
import { buildOverpassQuery, parseOverpassPlaces } from '@/domain/location';

/**
 * E8 (M4): the "nearby place" boundary. Isolated so the domain stays pure
 * and offline-first (ÂNCORA 10): this is the ONLY place that touches the network
 * for locations, it is OPT-IN, online-only, and NEVER throws or blocks — it
 * resolves null/[] on offline/timeout/error so the manual name + history
 * fallback always works. Coordinates are sent for this explicit lookup only;
 * raw GPS storage stays 100% local (ÂNCORA 8).
 */

export interface PlaceResult {
  label: string;
  placeId: string | null;
}

/** DEC-389 (G5): a place resolved FROM a name — carries the exact coordinates. */
export interface NamedPlaceResult {
  label: string;
  lat: number;
  lng: number;
  placeId: string | null;
}

// OpenStreetMap Nominatim reverse geocoder (free, public, attribution: © OSM).
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

// OpenStreetMap Nominatim forward geocoder (name → coordinates).
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

// OpenStreetMap Overpass API for nearby POIs by category (free, no API key).
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface NearbySearchOptions {
  radiusMeters?: number;
  limit?: number;
  timeoutMs?: number;
}

/**
 * Lists named establishments of a category near the coordinate, nearest first.
 * Opt-in / online-only: returns [] on offline, timeout, HTTP error, or an
 * unparsable payload, so the manual name + recent places fallback always works
 * and nothing ever blocks the capture.
 */
export async function searchNearbyPlaces(
  coords: Coords,
  category: string | null,
  options: NearbySearchOptions = {},
): Promise<NearbyPlace[]> {
  const { radiusMeters = 300, limit = 12, timeoutMs = 9000 } = options;
  if (!isOnline() || typeof fetch === 'undefined') return [];

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const query = buildOverpassQuery(coords, category, radiusMeters, limit * 4);
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller?.signal,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as unknown;
    return parseOverpassPlaces(data, coords, limit);
  } catch {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

/**
 * DEC-389 (G5): forward-geocode an establishment name to its exact coordinates —
 * the symmetric twin of `reverseGeocodePlace`. The AI captures the place NAME; this
 * resolves WHERE that name is so the expense lands on the real venue, not just the
 * GPS reading. Same boundary contract as every location lookup here: opt-in,
 * online-only, NEVER throws — returns null on offline, empty name, timeout, HTTP
 * error, no match, or unparsable payload, so the caller falls back to the GPS fix.
 *
 * When a `near` coordinate is given (the current fix), the search is BIASED to a
 * box around it and bounded to it, so a globally common name ("Starbucks") resolves
 * to the local venue instead of one in another country; a miss inside the box simply
 * returns null and the caller stamps the GPS point. Coordinates are sent for this
 * explicit lookup only (ÂNCORA 8).
 */
export async function searchPlaceByName(
  name: string,
  near?: Coords | null,
  timeoutMs = 6000,
): Promise<NamedPlaceResult | null> {
  const query = name.trim();
  if (query === '' || !isOnline() || typeof fetch === 'undefined') return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: query,
      limit: '1',
      addressdetails: '1',
    });
    // Bias + restrict to a ~50km box around the current location when known.
    if (near) {
      const d = 0.45;
      params.set('viewbox', `${near.lng - d},${near.lat - d},${near.lng + d},${near.lat + d}`);
      params.set('bounded', '1');
    }
    const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0] as Record<string, unknown>;

    const lat = Number(first['lat']);
    const lng = Number(first['lon']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const displayName = readString(first, 'display_name');
    const label = readString(first, 'name') ?? (displayName ? displayName.split(',')[0]!.trim() : query);
    const rawId = first['place_id'];
    return { label, lat, lng, placeId: rawId == null ? null : String(rawId) };
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
