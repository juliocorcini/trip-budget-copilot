import { describe, it, expect } from 'vitest';
import {
  resolveSaveLocation,
  resolveLocationDisplay,
  type TransactionPlaceFields,
  type SaveLocationFix,
} from '@/domain/location';

const EMPTY: TransactionPlaceFields = {
  placeLabel: null,
  latitude: null,
  longitude: null,
  placeId: null,
};

const FIX: SaveLocationFix = {
  lat: 41.1579,
  lng: -8.6291,
  accuracy: 12,
  capturedAt: '2026-06-27T10:00:00.000Z',
};

describe('resolveSaveLocation (DEC-367 / G8 — point on every save)', () => {
  it('stamps a captured point with a PROBABLE name when details were closed (fast save)', () => {
    const result = resolveSaveLocation({
      detailsOpen: false,
      chosen: EMPTY,
      fix: FIX,
      autoName: { label: 'Café Central', placeId: 'osm:42' },
    });
    expect(result.latitude).toBe(41.1579);
    expect(result.longitude).toBe(-8.6291);
    expect(result.placeLabel).toBe('Café Central');
    expect(result.placeId).toBe('osm:42');
    expect(result.placeNameSource).toBe('auto');
    expect(result.locationAccuracy).toBe(12);
    expect(result.locationCapturedAt).toBe('2026-06-27T10:00:00.000Z');
  });

  it('stamps the point but no name when reverse-geocode returned nothing (offline)', () => {
    const result = resolveSaveLocation({
      detailsOpen: false,
      chosen: EMPTY,
      fix: FIX,
      autoName: null,
    });
    expect(result.latitude).toBe(41.1579);
    expect(result.placeLabel).toBeNull();
    expect(result.placeNameSource).toBeNull();
  });

  it('treats an empty-string auto name as no name', () => {
    const result = resolveSaveLocation({
      detailsOpen: false,
      chosen: EMPTY,
      fix: FIX,
      autoName: { label: '   ', placeId: null },
    });
    expect(result.placeLabel).toBeNull();
    expect(result.placeNameSource).toBeNull();
    expect(result.latitude).toBe(41.1579);
  });

  it('keeps a user-chosen place (with coords + open details) as VERIFIED', () => {
    const chosen: TransactionPlaceFields = {
      placeLabel: 'Restaurante do Porto',
      latitude: 41.14,
      longitude: -8.61,
      placeId: 'osm:99',
    };
    const result = resolveSaveLocation({ detailsOpen: true, chosen, fix: null, autoName: null });
    expect(result.placeLabel).toBe('Restaurante do Porto');
    expect(result.latitude).toBe(41.14);
    expect(result.placeNameSource).toBe('user');
    // a chosen place's coords are not a fresh fix → no accuracy/timestamp
    expect(result.locationAccuracy).toBeNull();
    expect(result.locationCapturedAt).toBeNull();
  });

  it('marks an inherited sticky place (details closed, not confirmed) as PROBABLE', () => {
    const chosen: TransactionPlaceFields = {
      placeLabel: 'Bar da Praia',
      latitude: 41.1,
      longitude: -8.6,
      placeId: null,
    };
    const result = resolveSaveLocation({ detailsOpen: false, chosen, fix: null, autoName: null });
    expect(result.placeNameSource).toBe('auto');
    expect(result.latitude).toBe(41.1);
  });

  it('does not re-capture when the chosen place already has coordinates', () => {
    const chosen: TransactionPlaceFields = {
      placeLabel: 'Hotel',
      latitude: 1,
      longitude: 2,
      placeId: null,
    };
    const result = resolveSaveLocation({ detailsOpen: true, chosen, fix: FIX, autoName: null });
    expect(result.latitude).toBe(1);
    expect(result.longitude).toBe(2);
  });

  it('keeps a manual name with no coords (no GPS) as a name-only record', () => {
    const chosen: TransactionPlaceFields = {
      placeLabel: 'Casa da vó',
      latitude: null,
      longitude: null,
      placeId: null,
    };
    const result = resolveSaveLocation({ detailsOpen: true, chosen, fix: null, autoName: null });
    expect(result.placeLabel).toBe('Casa da vó');
    expect(result.latitude).toBeNull();
    expect(result.placeNameSource).toBe('user');
  });
});

describe('resolveLocationDisplay (DEC-368 / G8 — detail caption + map gate)', () => {
  it('shows a map + "probable" caption for an auto name', () => {
    const d = resolveLocationDisplay({
      latitude: 1,
      longitude: 2,
      placeLabel: 'Café Central',
      placeNameSource: 'auto',
    });
    expect(d.hasMap).toBe(true);
    expect(d.caption).toEqual({ kind: 'probable', name: 'Café Central' });
  });

  it('shows a map + plain name for a verified (user) name', () => {
    const d = resolveLocationDisplay({
      latitude: 1,
      longitude: 2,
      placeLabel: 'Café Central',
      placeNameSource: 'user',
    });
    expect(d.caption).toEqual({ kind: 'named', name: 'Café Central' });
  });

  it('shows a map + "approximate" caption when only coords (no name)', () => {
    const d = resolveLocationDisplay({ latitude: 1, longitude: 2, placeLabel: null });
    expect(d.hasMap).toBe(true);
    expect(d.caption).toEqual({ kind: 'approx' });
  });

  it('no map and no caption when there are no coords and no name', () => {
    const d = resolveLocationDisplay({ latitude: null, longitude: null, placeLabel: null });
    expect(d.hasMap).toBe(false);
    expect(d.caption).toEqual({ kind: 'none' });
  });

  it('shows a name with no map when there is a manual name but no coords', () => {
    const d = resolveLocationDisplay({
      latitude: null,
      longitude: null,
      placeLabel: 'Casa da vó',
      placeNameSource: 'user',
    });
    expect(d.hasMap).toBe(false);
    expect(d.caption).toEqual({ kind: 'named', name: 'Casa da vó' });
  });
});
