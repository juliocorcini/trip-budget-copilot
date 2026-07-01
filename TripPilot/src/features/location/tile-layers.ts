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

/**
 * DEC-426 (Field v2): plain imagery is "blind" — no street/place names. Esri
 * publishes transparent REFERENCE overlays on the SAME ArcGIS `{z}/{y}/{x}`
 * scheme that are meant to sit on top of imagery: boundaries + place labels, and
 * transportation (road) labels. Stacking them turns the satellite into a labelled
 * hybrid without leaving the satellite look. Best-effort/offline-safe like any
 * tile (Â-MAP-COORDS-REAL): if a reference tile 404s the imagery still shows.
 */
export const SATELLITE_REFERENCE_TILES: TileConfig[] = [
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19 },
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19 },
  },
];

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

/**
 * Build the Leaflet layer for a surface — the single spot that reads the config.
 *
 * DEC-426: satellite is now a `LayerGroup` = imagery + the Esri reference (label)
 * overlays, so street/place names show on top of the photo. Street stays a single
 * tile layer. Returns `L.Layer` (the common base of `TileLayer`/`LayerGroup`) so
 * callers `.addTo(map)`/`.remove()` it uniformly regardless of the surface.
 */
export function createTileLayer(kind: MapLayerKind): L.Layer {
  if (kind === 'satellite') {
    return L.layerGroup([
      L.tileLayer(SATELLITE_TILES.url, SATELLITE_TILES.options),
      ...SATELLITE_REFERENCE_TILES.map((t) => L.tileLayer(t.url, t.options)),
    ]);
  }
  const { url, options } = STREET_TILES;
  return L.tileLayer(url, options);
}
