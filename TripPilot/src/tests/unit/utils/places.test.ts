import { describe, it, expect, afterEach, vi } from 'vitest';
import { reverseGeocodePlace, searchNearbyPlaces, isOnline } from '@/utils/places';

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
