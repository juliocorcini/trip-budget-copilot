import { describe, it, expect } from 'vitest';
import {
  SATELLITE_TILES,
  SATELLITE_REFERENCE_TILES,
  STREET_TILES,
  TILE_CONFIG,
  DEFAULT_MAP_LAYER,
  createTileLayer,
} from '@/features/location/tile-layers';

// DEC-422 (G9): the satellite/street providers are shared by the expense-detail
// map and the G11 "spends on the map" screen. A wrong Esri axis order or maxZoom
// silently breaks tiles, so the provider contract is pinned here.

describe('tile providers (DEC-422)', () => {
  it('defaults to satellite everywhere', () => {
    expect(DEFAULT_MAP_LAYER).toBe('satellite');
    expect(TILE_CONFIG.satellite).toBe(SATELLITE_TILES);
    expect(TILE_CONFIG.street).toBe(STREET_TILES);
  });

  it('uses Esri World Imagery with the ArcGIS {z}/{y}/{x} axis order', () => {
    expect(SATELLITE_TILES.url).toContain('server.arcgisonline.com');
    expect(SATELLITE_TILES.url).toContain('World_Imagery/MapServer/tile');
    // ArcGIS is row-before-column: {z}/{y}/{x}, NOT the {z}/{x}/{y} of OSM.
    expect(SATELLITE_TILES.url).toContain('/{z}/{y}/{x}');
    expect(SATELLITE_TILES.url).not.toContain('/{z}/{x}/{y}');
    expect(SATELLITE_TILES.options.maxZoom).toBe(19);
    expect(String(SATELLITE_TILES.options.attribution)).toMatch(/Esri/);
  });

  it('keeps OSM as the street surface with the {z}/{x}/{y} axis order', () => {
    expect(STREET_TILES.url).toContain('tile.openstreetmap.org');
    expect(STREET_TILES.url).toContain('/{z}/{x}/{y}');
    expect(STREET_TILES.options.maxZoom).toBe(19);
    expect(String(STREET_TILES.options.attribution)).toMatch(/OpenStreetMap/);
  });
});

// DEC-426 (Field v2): satellite becomes a labelled hybrid — imagery PLUS the Esri
// transparent reference overlays (place/boundary names + road names) on the same
// ArcGIS {z}/{y}/{x} scheme. A wrong axis order would blank the labels.
describe('satellite labels — Esri reference overlays (DEC-426)', () => {
  it('ships boundaries+places and transportation reference layers on {z}/{y}/{x}', () => {
    expect(SATELLITE_REFERENCE_TILES).toHaveLength(2);
    const urls = SATELLITE_REFERENCE_TILES.map((t) => t.url);
    expect(urls.some((u) => u.includes('Reference/World_Boundaries_and_Places/MapServer'))).toBe(true);
    expect(urls.some((u) => u.includes('Reference/World_Transportation/MapServer'))).toBe(true);
    for (const t of SATELLITE_REFERENCE_TILES) {
      expect(t.url).toContain('server.arcgisonline.com');
      // Same ArcGIS row-before-column order as the imagery, never OSM's {z}/{x}/{y}.
      expect(t.url).toContain('/{z}/{y}/{x}');
      expect(t.url).not.toContain('/{z}/{x}/{y}');
      expect(t.options.maxZoom).toBe(19);
    }
  });

  it('composes satellite as a LayerGroup (imagery + both reference layers), street as a single layer', () => {
    const satellite = createTileLayer('satellite') as unknown as {
      getLayers?: () => unknown[];
    };
    expect(typeof satellite.getLayers).toBe('function');
    // 1 imagery + 2 reference overlays = 3 stacked layers.
    expect(satellite.getLayers!()).toHaveLength(3);

    const street = createTileLayer('street') as unknown as { getLayers?: () => unknown[] };
    // A plain tile layer is NOT a group.
    expect(typeof street.getLayers).toBe('undefined');
  });
});
