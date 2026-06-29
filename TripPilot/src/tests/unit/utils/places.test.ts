import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  reverseGeocodePlace,
  searchNearbyPlaces,
  searchPlaceByName,
  searchPlacesByName,
  isOnline,
} from '@/utils/places';

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  vi.unstubAllGlobals();
  setOnline(true);
});

describe('isOnline', () => {
  it('reflects navigator.onLine', () => {
    setOnline(true);
    expect(isOnline()).toBe(true);
    setOnline(false);
    expect(isOnline()).toBe(false);
  });
});

describe('reverseGeocodePlace (M4)', () => {
  it('returns null when offline (never touches the network)', async () => {
    setOnline(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(reverseGeocodePlace({ lat: 38.72, lng: -9.13 })).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('parses the POI name from a successful response', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => ({ name: 'Time Out Market', place_id: 12345 }),
    });
    await expect(reverseGeocodePlace({ lat: 38.72, lng: -9.13 })).resolves.toEqual({
      label: 'Time Out Market',
      placeId: '12345',
    });
  });

  it('falls back to address parts when there is no POI name', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => ({
        address: { road: 'Rua Augusta', city: 'Lisboa' },
        place_id: 7,
      }),
    });
    await expect(reverseGeocodePlace({ lat: 38.71, lng: -9.14 })).resolves.toEqual({
      label: 'Rua Augusta, Lisboa',
      placeId: '7',
    });
  });

  it('returns null on a non-OK HTTP status', async () => {
    setOnline(true);
    mockFetchOnce({ ok: false, json: async () => ({}) });
    await expect(reverseGeocodePlace({ lat: 1, lng: 2 })).resolves.toBeNull();
  });

  it('returns null when the request throws (never blocks the caller)', async () => {
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(reverseGeocodePlace({ lat: 1, lng: 2 })).resolves.toBeNull();
  });

  it('returns null when the payload has no usable label', async () => {
    setOnline(true);
    mockFetchOnce({ ok: true, json: async () => ({ place_id: 9 }) });
    await expect(reverseGeocodePlace({ lat: 1, lng: 2 })).resolves.toBeNull();
  });
});

describe('searchNearbyPlaces (M4 — nearby establishments)', () => {
  const origin = { lat: 38.7167, lng: -9.1399 };

  it('returns [] when offline (never touches the network)', async () => {
    setOnline(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchNearbyPlaces(origin, 'restaurant')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs an Overpass query and returns parsed places nearest-first', async () => {
    setOnline(true);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          { type: 'node', id: 2, lat: 38.72, lon: -9.1399, tags: { name: 'Far' } },
          { type: 'node', id: 1, lat: 38.7168, lon: -9.1399, tags: { name: 'Near', amenity: 'restaurant' } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await searchNearbyPlaces(origin, 'restaurant');
    expect(result.map((p) => p.label)).toEqual(['Near', 'Far']);
    expect(result[0]!.placeId).toBe('osm:node:1');

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toContain('overpass');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('restaurant');
  });

  it('returns [] on a non-OK HTTP status', async () => {
    setOnline(true);
    mockFetchOnce({ ok: false, json: async () => ({}) });
    await expect(searchNearbyPlaces(origin, 'bar')).resolves.toEqual([]);
  });

  it('returns [] when the request throws (never blocks capture)', async () => {
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('overpass down')));
    await expect(searchNearbyPlaces(origin, null)).resolves.toEqual([]);
  });
});

describe('searchPlaceByName (DEC-389 · G5 — name → coordinates)', () => {
  const near = { lat: 38.7167, lng: -9.1399 };

  it('returns null when offline (never touches the network)', async () => {
    setOnline(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchPlaceByName('Time Out Market', near)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null for an empty / whitespace name (never touches the network)', async () => {
    setOnline(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchPlaceByName('   ', near)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves the exact coordinates, placeId and label from the first match', async () => {
    setOnline(true);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Time Out Market', lat: '38.7067', lon: '-9.1459', place_id: 555 },
        { name: 'Another', lat: '1', lon: '2', place_id: 1 },
      ],
    });
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchPlaceByName('Time Out Market', near)).resolves.toEqual({
      label: 'Time Out Market',
      lat: 38.7067,
      lng: -9.1459,
      placeId: '555',
    });
  });

  it('biases AND bounds the search to a box around the fix when one is given', async () => {
    setOnline(true);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'Local Starbucks', lat: '38.71', lon: '-9.14', place_id: 9 }],
    });
    vi.stubGlobal('fetch', fetchSpy);
    await searchPlaceByName('Starbucks', near);
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('bounded=1');
    expect(url).toContain('viewbox=');
    expect(url).toContain(encodeURIComponent('Starbucks'));
  });

  it('omits the viewbox bias when no coordinate is provided', async () => {
    setOnline(true);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'X', lat: '1', lon: '2', place_id: 1 }],
    });
    vi.stubGlobal('fetch', fetchSpy);
    await searchPlaceByName('Eiffel Tower');
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).not.toContain('viewbox=');
    expect(url).not.toContain('bounded=');
  });

  it('falls back to the first segment of display_name when there is no name', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => [{ display_name: 'Praça do Comércio, Lisboa, Portugal', lat: '38.70', lon: '-9.13', place_id: 3 }],
    });
    await expect(searchPlaceByName('Praça do Comércio', near)).resolves.toEqual({
      label: 'Praça do Comércio',
      lat: 38.7,
      lng: -9.13,
      placeId: '3',
    });
  });

  it('returns null on an empty result set (caller falls back to GPS)', async () => {
    setOnline(true);
    mockFetchOnce({ ok: true, json: async () => [] });
    await expect(searchPlaceByName('Nonexistent place', near)).resolves.toBeNull();
  });

  it('returns null when coordinates are unparsable', async () => {
    setOnline(true);
    mockFetchOnce({ ok: true, json: async () => [{ name: 'Bad', lat: 'x', lon: 'y', place_id: 1 }] });
    await expect(searchPlaceByName('Bad', near)).resolves.toBeNull();
  });

  it('returns null on a non-OK HTTP status', async () => {
    setOnline(true);
    mockFetchOnce({ ok: false, json: async () => [] });
    await expect(searchPlaceByName('Whatever', near)).resolves.toBeNull();
  });

  it('returns null when the request throws (never blocks the save)', async () => {
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('nominatim down')));
    await expect(searchPlaceByName('Whatever', near)).resolves.toBeNull();
  });
});

describe('searchPlacesByName (DEC-405 · G5 — name → list of real venues)', () => {
  const near = { lat: 38.7167, lng: -9.1399 };

  it('returns [] when offline (never touches the network)', async () => {
    setOnline(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchPlacesByName('Bar do Zé', near)).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns [] for an empty / whitespace name (never touches the network)', async () => {
    setOnline(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchPlacesByName('   ', near)).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps EVERY match to a real venue with exact coordinates (order preserved)', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => [
        { name: 'Bar do Zé', lat: '38.71', lon: '-9.14', place_id: 11 },
        { display_name: 'Bar do Zé 2, Lisboa, Portugal', lat: '38.72', lon: '-9.15', place_id: 22 },
      ],
    });
    await expect(searchPlacesByName('Bar do Zé', near)).resolves.toEqual([
      { label: 'Bar do Zé', lat: 38.71, lng: -9.14, placeId: '11' },
      { label: 'Bar do Zé 2', lat: 38.72, lng: -9.15, placeId: '22' },
    ]);
  });

  it('caps the result count at the requested limit', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => [
        { name: 'A', lat: '1', lon: '1', place_id: 1 },
        { name: 'B', lat: '2', lon: '2', place_id: 2 },
        { name: 'C', lat: '3', lon: '3', place_id: 3 },
      ],
    });
    const result = await searchPlacesByName('cafe', near, 2);
    expect(result.map((p) => p.label)).toEqual(['A', 'B']);
  });

  it('skips entries with unparsable coordinates but keeps the valid ones', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => [
        { name: 'Bad', lat: 'x', lon: 'y', place_id: 1 },
        { name: 'Good', lat: '38.70', lon: '-9.13', place_id: 2 },
      ],
    });
    await expect(searchPlacesByName('mix', near)).resolves.toEqual([
      { label: 'Good', lat: 38.7, lng: -9.13, placeId: '2' },
    ]);
  });

  it('biases AND bounds the search to a box around the fix when one is given', async () => {
    setOnline(true);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'Local', lat: '38.71', lon: '-9.14', place_id: 9 }],
    });
    vi.stubGlobal('fetch', fetchSpy);
    await searchPlacesByName('Starbucks', near, 5);
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('bounded=1');
    expect(url).toContain('viewbox=');
    expect(url).toContain('limit=5');
  });

  it('returns [] on a non-OK HTTP status', async () => {
    setOnline(true);
    mockFetchOnce({ ok: false, json: async () => [] });
    await expect(searchPlacesByName('whatever', near)).resolves.toEqual([]);
  });

  it('returns [] when the request throws (never blocks the field)', async () => {
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('nominatim down')));
    await expect(searchPlacesByName('whatever', near)).resolves.toEqual([]);
  });
});
