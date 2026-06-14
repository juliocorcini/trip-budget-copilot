import { describe, it, expect, afterEach, vi } from 'vitest';
import { reverseGeocodePlace, isOnline } from '@/utils/places';

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
