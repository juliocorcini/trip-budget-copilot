import { describe, it, expect } from 'vitest';
import { buildPlaceSuggestions } from '@/domain/location';
import type { NearbyPlace, RecentPlace } from '@/domain/location';

function nearby(over: Partial<NearbyPlace> = {}): NearbyPlace {
  return {
    label: 'Nearby Bar',
    lat: 38.72,
    lng: -9.13,
    placeId: null,
    distanceMeters: 50,
    kind: 'bar',
    ...over,
  };
}

function recent(over: Partial<RecentPlace> = {}): RecentPlace {
  return {
    label: 'Recent Bar',
    lat: 41.15,
    lng: -8.62,
    placeId: null,
    lastUsedAt: '2026-01-01T00:00:00.000Z',
    count: 1,
    distanceMeters: null,
    ...over,
  };
}

describe('buildPlaceSuggestions (F14)', () => {
  it('lists nearby places before recent ones, preserving input order', () => {
    const result = buildPlaceSuggestions(
      [nearby({ label: 'A', distanceMeters: 10 }), nearby({ label: 'B', distanceMeters: 30 })],
      [recent({ label: 'R1' }), recent({ label: 'R2' })],
      '',
    );
    expect(result.map((s) => s.label)).toEqual(['A', 'B', 'R1', 'R2']);
    expect(result.map((s) => s.source)).toEqual(['nearby', 'nearby', 'recent', 'recent']);
  });

  it('de-dupes by provider place id — the nearby entry wins', () => {
    const result = buildPlaceSuggestions(
      [nearby({ label: 'Fresh name', placeId: 'osm:1', distanceMeters: 20 })],
      [recent({ label: 'Old name', placeId: 'osm:1' })],
      '',
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ label: 'Fresh name', source: 'nearby', distanceMeters: 20 });
  });

  it('de-dupes by normalized label when there is no place id', () => {
    const result = buildPlaceSuggestions(
      [nearby({ label: 'Café Central' })],
      [recent({ label: 'café central' })],
      '',
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('nearby');
  });

  it('drops the already-selected place (by label, accent/case-insensitive)', () => {
    const result = buildPlaceSuggestions(
      [nearby({ label: 'Tasca da Esquina' }), nearby({ label: 'Other' })],
      [],
      '',
      'tasca da esquina',
    );
    expect(result.map((s) => s.label)).toEqual(['Other']);
  });

  it('filters by an accent-insensitive substring query', () => {
    const result = buildPlaceSuggestions(
      [nearby({ label: 'Café Central' }), nearby({ label: 'Pizzaria Napoli' })],
      [recent({ label: 'Cafeteria do Porto' })],
      'cafe',
    );
    expect(result.map((s) => s.label)).toEqual(['Café Central', 'Cafeteria do Porto']);
  });

  it('returns an empty list when the query matches nothing', () => {
    const result = buildPlaceSuggestions([nearby({ label: 'Bar' })], [recent({ label: 'Pub' })], 'zzz');
    expect(result).toEqual([]);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) => nearby({ label: `P${i}`, distanceMeters: i }));
    expect(buildPlaceSuggestions(many, [], '', null, 5)).toHaveLength(5);
  });

  it('carries coordinates and distance through for the picker', () => {
    const [first] = buildPlaceSuggestions(
      [nearby({ label: 'X', lat: 1, lng: 2, placeId: 'osm:9', distanceMeters: 42 })],
      [],
      '',
    );
    expect(first).toMatchObject({ lat: 1, lng: 2, placeId: 'osm:9', distanceMeters: 42, source: 'nearby' });
  });
});
