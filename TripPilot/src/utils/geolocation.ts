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
 * DEC-367 (G8): a full GPS fix — coordinates plus the accuracy (meters, when
 * the platform reports it) and the capture timestamp. Used by the save path to
 * stamp a point on every expense; `getCurrentCoords` is the thin coords-only
 * view kept for existing callers.
 */
export interface LocationFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  capturedAt: string;
}

/** Coerces a possibly-undefined accuracy reading to `number | null`. */
function normalizeAccuracy(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Reads the current GPS fix (coords + accuracy + timestamp). Opt-in — only call
 * when the traveler enabled location capture. NEVER throws and NEVER blocks a
 * save: resolves null on denial, timeout, unsupported, or any error
 * (ÂNCORA 8 / 10). Works fully offline and never leaves the device.
 */
export function getCurrentFix(timeoutMs: number = 8000): Promise<LocationFix | null> {
  if (isNativeApp()) return getNativeFix(timeoutMs);
  return getWebFix(timeoutMs);
}

/**
 * Reads the current GPS coordinates. Opt-in — only call when the traveler has
 * enabled location capture. NEVER throws and NEVER blocks a save: resolves null
 * on denial, timeout, unsupported, or any error (ÂNCORA 8 / 10). Coordinates
 * work fully offline and never leave the device.
 */
export async function getCurrentCoords(timeoutMs: number = 8000): Promise<Coords | null> {
  const fix = await getCurrentFix(timeoutMs);
  return fix ? { lat: fix.lat, lng: fix.lng } : null;
}

function getWebFix(timeoutMs: number): Promise<LocationFix | null> {
  if (!isGeolocationSupported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: LocationFix | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          finish({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: normalizeAccuracy(position.coords.accuracy),
            capturedAt: new Date().toISOString(),
          }),
        () => finish(null),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
      );
    } catch {
      finish(null);
    }
  });
}

async function getNativeFix(timeoutMs: number): Promise<LocationFix | null> {
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 60_000,
    });
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: normalizeAccuracy(position.coords.accuracy),
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
