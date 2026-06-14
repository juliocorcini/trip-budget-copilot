import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  shouldReaskPlace,
  coordsLabel,
  placeToTransactionFields,
  placesEqual,
  DEFAULT_REASK_THRESHOLD_METERS,
} from '@/domain/location';
import type { CurrentPlace } from '@/domain/types/common';

const porto: CurrentPlace = { label: 'Bar do Porto', lat: 41.1579, lng: -8.6291, placeId: null };

describe('haversineMeters (M3)', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters({ lat: 41.1579, lng: -8.6291 }, { lat: 41.1579, lng: -8.6291 })).toBe(0);
  });

  it('matches one degree of latitude (~111.19 km)', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    // 2πR/360 with R=6371000 → 111194.9 m
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('measures a small move (~111 m for 0.001° of latitude)', () => {
    const d = haversineMeters({ lat: 41.1579, lng: -8.6291 }, { lat: 41.1589, lng: -8.6291 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
});

describe('shouldReaskPlace (M3)', () => {
  it('always re-asks when there is no current place', () => {
    expect(shouldReaskPlace(null, { lat: 41.1579, lng: -8.6291 })).toBe(true);
  });

  it('inherits the place when still in the same area (within threshold)', () => {
    // ~111 m move, default threshold 150 m → keep the place.
    expect(shouldReaskPlace(porto, { lat: 41.1589, lng: -8.6291 })).toBe(false);
  });

  it('re-asks after moving beyond the threshold', () => {
    // ~333 m move → past the 150 m threshold.
    expect(shouldReaskPlace(porto, { lat: 41.1609, lng: -8.6291 })).toBe(true);
  });

  it('honors a custom threshold', () => {
    // Same ~111 m move, but a tight 50 m threshold → re-ask.
    expect(shouldReaskPlace(porto, { lat: 41.1589, lng: -8.6291 }, 50)).toBe(true);
  });

  it('default threshold is 150 m', () => {
    expect(DEFAULT_REASK_THRESHOLD_METERS).toBe(150);
  });
});

describe('coordsLabel', () => {
  it('formats coordinates to 4 decimals', () => {
    expect(coordsLabel({ lat: 41.157923, lng: -8.629105 })).toBe('41.1579, -8.6291');
  });
});

describe('placeToTransactionFields', () => {
  it('maps a place to the four transaction fields', () => {
    expect(placeToTransactionFields(porto)).toEqual({
      placeLabel: 'Bar do Porto',
      latitude: 41.1579,
      longitude: -8.6291,
      placeId: null,
    });
  });

  it('returns all nulls for no place', () => {
    expect(placeToTransactionFields(null)).toEqual({
      placeLabel: null,
      latitude: null,
      longitude: null,
      placeId: null,
    });
  });
});

describe('placesEqual', () => {
  it('treats two null places as equal', () => {
    expect(placesEqual(null, null)).toBe(true);
  });

  it('is false when only one is null', () => {
    expect(placesEqual(porto, null)).toBe(false);
    expect(placesEqual(null, porto)).toBe(false);
  });

  it('compares all fields structurally', () => {
    expect(placesEqual(porto, { ...porto })).toBe(true);
    expect(placesEqual(porto, { ...porto, label: 'Other' })).toBe(false);
    expect(placesEqual(porto, { ...porto, lat: 41.16 })).toBe(false);
  });
});
