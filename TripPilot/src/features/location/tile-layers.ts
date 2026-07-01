import * as L from 'leaflet';

/**
 * DEC-422 (G9): shared Leaflet tile providers so the expense-detail map and the
 * G11 "spends on the map" screen use the SAME satellite/street sources (one place
 * to fix a URL or attribution). Satellite is the default surface.
 *
 * Esri "World Imagery" uses the ArcGIS tile scheme, whose path order is
 * `{z}/{y}/{x}` (row before column) — NOT the `{z}/{x}/{y}` of OSM/XYZ. Getting
 * that axis order wrong yields shuffled/blank tiles, so it is asserted by a test.
 */
export type MapLayerKind = 'satellite' | 'street';

interface TileConfig {
  url: string;
  options: L.TileLayerOptions;
}

export const SATELLITE_TILES: TileConfig = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  options: {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
  },
};

export const STREET_TILES: TileConfig = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  },
};

export const TILE_CONFIG: Record<MapLayerKind, TileConfig> = {
  satellite: SATELLITE_TILES,
  street: STREET_TILES,
};

/** The surface shown by default across every map in the app (DEC-422 default a). */
export const DEFAULT_MAP_LAYER: MapLayerKind = 'satellite';

/** Build a Leaflet tile layer for a kind — the single spot that reads the config. */
export function createTileLayer(kind: MapLayerKind): L.TileLayer {
  const { url, options } = TILE_CONFIG[kind];
  return L.tileLayer(url, options);
}
