import { describe, it, expect, afterEach } from 'vitest';
import { getCurrentCoords, isGeolocationSupported } from '@/utils/geolocation';

function defineGeolocation(value: unknown): void {
  Object.defineProperty(navigator, 'geolocation', { value, configurable: true });
}

function removeGeolocation(): void {
  if (Object.getOwnPropertyDescriptor(navigator, 'geolocation')) {
    Reflect.deleteProperty(navigator, 'geolocation');
  }
}

afterEach(removeGeolocation);

describe('geolocation boundary (M2)', () => {
  it('reports unsupported when the API is absent', () => {
    removeGeolocation();
    expect(isGeolocationSupported()).toBe(false);
  });

  it('resolves coordinates on a successful reading', async () => {
    defineGeolocation({
      getCurrentPosition: (success: PositionCallback) =>
        success({ coords: { latitude: 41.1579, longitude: -8.6291 } } as GeolocationPosition),
    });
    expect(isGeolocationSupported()).toBe(true);
    await expect(getCurrentCoords()).resolves.toEqual({ lat: 41.1579, lng: -8.6291 });
  });

  it('resolves null when permission is denied (never throws)', async () => {
    defineGeolocation({
      getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback) =>
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError),
    });
    await expect(getCurrentCoords()).resolves.toBeNull();
  });

  it('resolves null when unsupported (the save is never blocked)', async () => {
    removeGeolocation();
    await expect(getCurrentCoords()).resolves.toBeNull();
  });
});
