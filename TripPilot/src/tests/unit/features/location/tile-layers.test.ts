import { describe, it, expect } from 'vitest';
import {
  SATELLITE_TILES,
  STREET_TILES,
  TILE_CONFIG,
  DEFAULT_MAP_LAYER,
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
