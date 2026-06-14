import type { Coords } from './location';
import { haversineMeters } from './location';

/**
 * E8 (M4, deferred): nearby establishments by category. Pure helpers for the
 * "places around me" picker — the category→OSM mapping, the Overpass query
 * string, and the response parser/sort. The network call itself lives in the
 * `utils/places.ts` boundary (ÂNCORA 10: opt-in, online-only, offline fallback).
 * Coordinates are sent only for this explicit lookup; nothing is stored from it
 * beyond the name the traveler picks (ÂNCORA 8).
 */

export interface NearbyPlace {
  label: string;
  lat: number;
  lng: number;
  /** Stable OSM id ("osm:node:123") so the same venue dedupes across lookups. */
  placeId: string | null;
  distanceMeters: number;
  /** Raw OSM subtype (e.g. "restaurant", "bar") for an optional caption. */
  kind: string | null;
}

/**
 * Maps a spend category to OSM tag selectors. Data-driven (no per-category
 * branching at the call site). A category with no sensible mapping falls back to
 * a broad "named establishments nearby" query so the picker still helps.
 */
const CATEGORY_OSM_FILTERS: Record<string, string[]> = {
  restaurant: ['["amenity"~"^(restaurant|fast_food|food_court|cafe)$"]'],
  bar: ['["amenity"~"^(bar|pub|biergarten|nightclub|cafe)$"]'],
  market: ['["shop"~"^(supermarket|convenience|grocery|greengrocer|bakery)$"]'],
  accommodation: ['["tourism"~"^(hotel|hostel|guest_house|motel|apartment)$"]'],
  health: ['["amenity"~"^(pharmacy|hospital|clinic|doctors|dentist)$"]'],
  clothing: ['["shop"~"^(clothes|boutique|fashion|shoes|department_store)$"]'],
  gifts: ['["shop"~"^(gift|souvenir|art)$"]'],
  entertainment: ['["amenity"~"^(cinema|theatre|nightclub|arts_centre)$"]', '["leisure"]'],
  transport: [
    '["amenity"~"^(fuel|bus_station|taxi)$"]',
    '["public_transport"="station"]',
    '["railway"="station"]',
  ],
  festival: ['["amenity"~"^(events_venue|community_centre)$"]', '["tourism"="attraction"]'],
};

/** Broad fallback: any named amenity/shop/tourism/leisure node nearby. */
const GENERIC_OSM_FILTERS = ['["amenity"]', '["shop"]', '["tourism"]', '["leisure"]'];

export function osmFiltersForCategory(category: string | null): string[] {
  if (category && category in CATEGORY_OSM_FILTERS) return CATEGORY_OSM_FILTERS[category]!;
  return GENERIC_OSM_FILTERS;
}

/**
 * Builds an Overpass QL query for named POIs of the category within `radius`
 * meters of the coordinate. `limit` caps the server-side result count.
 */
export function buildOverpassQuery(
  coords: Coords,
  category: string | null,
  radiusMeters = 300,
  limit = 40,
): string {
  const around = `(around:${radiusMeters},${coords.lat},${coords.lng})`;
  const clauses = osmFiltersForCategory(category)
    .map((filter) => `node${filter}["name"]${around};`)
    .join('');
  return `[out:json][timeout:10];(${clauses});out body ${limit};`;
}

function readKind(tags: Record<string, unknown> | undefined): string | null {
  if (!tags) return null;
  for (const key of ['amenity', 'shop', 'tourism', 'leisure']) {
    const value = tags[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

/**
 * Parses an Overpass JSON payload into nearby places: keeps only named nodes
 * with coordinates, dedupes by name, computes the distance from `origin`, sorts
 * nearest-first, and caps the list. Never throws on a malformed payload.
 */
export function parseOverpassPlaces(payload: unknown, origin: Coords, limit = 12): NearbyPlace[] {
  const elements =
    payload && typeof payload === 'object' ? (payload as { elements?: unknown }).elements : null;
  if (!Array.isArray(elements)) return [];

  const seen = new Set<string>();
  const places: NearbyPlace[] = [];

  for (const element of elements) {
    if (!element || typeof element !== 'object') continue;
    const el = element as Record<string, unknown>;
    const tags = el.tags as Record<string, unknown> | undefined;
    const name = tags?.name;
    const lat = typeof el.lat === 'number' ? el.lat : (el.center as { lat?: number })?.lat;
    const lng = typeof el.lon === 'number' ? el.lon : (el.center as { lon?: number })?.lon;
    if (typeof name !== 'string' || name.trim() === '') continue;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    const label = name.trim();
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const placeId =
      el.id != null ? `osm:${typeof el.type === 'string' ? el.type : 'node'}:${el.id}` : null;
    places.push({
      label,
      lat,
      lng,
      placeId,
      distanceMeters: haversineMeters(origin, { lat, lng }),
      kind: readKind(tags),
    });
  }

  places.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return places.slice(0, limit);
}

/** Compact distance label for the picker ("80 m", "1.2 km"). */
export function formatDistanceShort(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
