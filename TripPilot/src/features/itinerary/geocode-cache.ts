const LS_KEY = 'itinerary_geocode_cache';

interface CacheEntry {
  lat: number;
  lng: number;
  ts: number;
}

type Cache = Record<string, CacheEntry>;

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch { /* noop */ }
}

export interface GeoPoint {
  cityName: string;
  lat: number;
  lng: number;
}

/**
 * Geocode a city name using Nominatim with localStorage caching.
 * Cache entries expire after 30 days.
 */
export async function geocodeCity(cityName: string): Promise<GeoPoint | null> {
  const cache = readCache();
  const key = cityName.toLowerCase().trim();
  const cached = cache[key];

  if (cached && Date.now() - cached.ts < 30 * 24 * 60 * 60 * 1000) {
    return { cityName, lat: cached.lat, lng: cached.lng };
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`,
      { headers: { 'User-Agent': 'TripPilot/2.12 (travel-budget-app)' } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.length === 0) return null;

    const result = data[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    cache[key] = { lat, lng, ts: Date.now() };
    writeCache(cache);

    return { cityName, lat, lng };
  } catch {
    return null;
  }
}

/**
 * Geocode multiple cities sequentially with a small delay to respect Nominatim rate limits.
 * Returns only successfully geocoded points.
 */
export async function geocodeCities(cityNames: string[]): Promise<GeoPoint[]> {
  const results: GeoPoint[] = [];
  const unique = [...new Set(cityNames)];

  for (let i = 0; i < unique.length; i++) {
    const point = await geocodeCity(unique[i]!);
    if (point) results.push(point);
    if (i < unique.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
