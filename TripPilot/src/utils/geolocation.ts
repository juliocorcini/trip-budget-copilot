import type { Coords } from '@/domain/location';
import { isNativeApp } from '@/utils/native/platform';

/** E8 (M2): the Geolocation boundary. Isolated so the domain stays pure and
 * the rest of the app never touches `navigator.geolocation` directly.
 * N5 (native): in the APK, coordinates and permission flow go through the
 * Capacitor plugin; on the Web the original `navigator.geolocation` path is
 * untouched (so the browser prompt and existing tests behave identically). */

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export type LocationPermission = 'granted' | 'denied' | 'unsupported';

/**
 * N5: ensures the app is allowed to read the location BEFORE capturing.
 * Native: asks the OS (returns the real grant/deny). Web: the browser only
 * prompts on the first `getCurrentPosition`, so here we just report whether
 * the API exists — the actual prompt still happens in `getCurrentCoords`.
 */
export async function ensureLocationPermission(): Promise<LocationPermission> {
  if (!isNativeApp()) {
    return isGeolocationSupported() ? 'granted' : 'unsupported';
  }
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const status = await Geolocation.checkPermissions();
    if (status.location === 'granted' || status.coarseLocation === 'granted') return 'granted';
    const requested = await Geolocation.requestPermissions();
    return requested.location === 'granted' || requested.coarseLocation === 'granted'
      ? 'granted'
      : 'denied';
  } catch {
    return 'unsupported';
  }
}

/**
 * Reads the current GPS coordinates. Opt-in — only call when the traveler has
 * enabled location capture. NEVER throws and NEVER blocks a save: resolves null
 * on denial, timeout, unsupported, or any error (ÂNCORA 8 / 10). Coordinates
 * work fully offline and never leave the device.
 */
export function getCurrentCoords(timeoutMs: number = 8000): Promise<Coords | null> {
  if (isNativeApp()) return getNativeCoords(timeoutMs);
  return getWebCoords(timeoutMs);
}

function getWebCoords(timeoutMs: number): Promise<Coords | null> {
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

async function getNativeCoords(timeoutMs: number): Promise<Coords | null> {
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 60_000,
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return null;
  }
}
