import type { Coords } from '@/domain/location';

/** E8 (M2): the Geolocation boundary. Isolated so the domain stays pure and
 * the rest of the app never touches `navigator.geolocation` directly. */

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Reads the current GPS coordinates. Opt-in — only call when the traveler has
 * enabled location capture. NEVER throws and NEVER blocks a save: resolves null
 * on denial, timeout, unsupported, or any error (ÂNCORA 8 / 10). Coordinates
 * work fully offline and never leave the device.
 */
export function getCurrentCoords(timeoutMs: number = 8000): Promise<Coords | null> {
  if (!isGeolocationSupported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: Coords | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          finish({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => finish(null),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
      );
    } catch {
      finish(null);
    }
  });
}
