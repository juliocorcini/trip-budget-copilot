import { describe, it, expect } from 'vitest';
import {
  osmFiltersForCategory,
  buildOverpassQuery,
  parseOverpassPlaces,
  formatDistanceShort,
} from '@/domain/location';

const ORIGIN = { lat: 38.7167, lng: -9.1399 }; // Lisbon

describe('osmFiltersForCategory', () => {
  it('maps a known category to its specific OSM selectors', () => {
    expect(osmFiltersForCategory('restaurant')).toEqual([
      '["amenity"~"^(restaurant|fast_food|food_court|cafe)$"]',
    ]);
    expect(osmFiltersForCategory('market')[0]).toContain('shop');
    expect(osmFiltersForCategory('accommodation')[0]).toContain('tourism');
  });

  it('falls back to broad named-POI selectors for unmapped or null categories', () => {
    const generic = ['["amenity"]', '["shop"]', '["tourism"]', '["leisure"]'];
    expect(osmFiltersForCategory(null)).toEqual(generic);
    expect(osmFiltersForCategory('reconciliation')).toEqual(generic);
    expect(osmFiltersForCategory('other')).toEqual(generic);
  });
});

describe('buildOverpassQuery', () => {
  it('embeds the radius, coordinates, name filter and a node clause per selector', () => {
    const query = buildOverpassQuery(ORIGIN, 'transport', 250, 40);
    expect(query).toContain('around:250,38.7167,-9.1399');
    expect(query).toContain('["name"]');
    expect(query).toContain('out body 40;');
    // transport has 3 selectors → 3 node clauses
    expect(query.match(/node/g)?.length).toBe(3);
  });

  it('uses the generic selectors for an unmapped category', () => {
    const query = buildOverpassQuery(ORIGIN, 'home_day');
    expect(query.match(/node/g)?.length).toBe(4);
  });
});

describe('parseOverpassPlaces', () => {
  const payload = {
    elements: [
      { type: 'node', id: 2, lat: 38.7200, lon: -9.1399, tags: { name: 'Far Cafe', amenity: 'cafe' } },
      { type: 'node', id: 1, lat: 38.7168, lon: -9.1399, tags: { name: 'Near Bistro', amenity: 'restaurant' } },
      { type: 'node', id: 3, lat: 38.7169, lon: -9.1400, tags: { amenity: 'restaurant' } }, // no name → dropped
      { type: 'node', id: 4, tags: { name: 'No Coords' } }, // no coords → dropped
    ],
  };

  it('keeps named nodes with coordinates and sorts them nearest-first', () => {
    const result = parseOverpassPlaces(payload, ORIGIN);
    expect(result.map((p) => p.label)).toEqual(['Near Bistro', 'Far Cafe']);
    expect(result[0]!.distanceMeters).toBeLessThan(result[1]!.distanceMeters);
    expect(result[0]!.distanceMeters).toBeLessThan(50);
  });

  it('builds a stable OSM placeId and reads the kind', () => {
    const [nearest] = parseOverpassPlaces(payload, ORIGIN);
    expect(nearest!.placeId).toBe('osm:node:1');
    expect(nearest!.kind).toBe('restaurant');
  });

  it('dedupes by name (case-insensitive) keeping the first occurrence', () => {
    const dupes = {
      elements: [
        { type: 'node', id: 10, lat: 38.7168, lon: -9.1399, tags: { name: 'Cafe X' } },
        { type: 'node', id: 11, lat: 38.7300, lon: -9.1399, tags: { name: 'cafe x' } },
      ],
    };
    expect(parseOverpassPlaces(dupes, ORIGIN)).toHaveLength(1);
  });

  it('respects the limit', () => {
    const many = {
      elements: Array.from({ length: 30 }, (_, i) => ({
        type: 'node',
        id: i,
        lat: 38.7168 + i * 0.0001,
        lon: -9.1399,
        tags: { name: `Place ${i}` },
      })),
    };
    expect(parseOverpassPlaces(many, ORIGIN, 5)).toHaveLength(5);
  });

  it('returns [] for malformed payloads (never throws)', () => {
    expect(parseOverpassPlaces(null, ORIGIN)).toEqual([]);
    expect(parseOverpassPlaces({}, ORIGIN)).toEqual([]);
    expect(parseOverpassPlaces({ elements: 'nope' }, ORIGIN)).toEqual([]);
    expect(parseOverpassPlaces({ elements: [null, 42, 'x'] }, ORIGIN)).toEqual([]);
  });
});

describe('formatDistanceShort', () => {
  it('uses meters under 1 km and kilometers above', () => {
    expect(formatDistanceShort(80)).toBe('80 m');
    expect(formatDistanceShort(640.6)).toBe('641 m');
    expect(formatDistanceShort(1250)).toBe('1.3 km');
  });

  it('returns an empty string for invalid input', () => {
    expect(formatDistanceShort(-5)).toBe('');
    expect(formatDistanceShort(NaN)).toBe('');
  });
});
