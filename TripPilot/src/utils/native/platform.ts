import { Capacitor } from '@capacitor/core';

/**
 * Single source of truth for "are we running inside the Capacitor native shell?"
 * (DEC-191). Every native-only behavior is gated by this so the web/PWA build is
 * never affected. Kept in its own module to avoid import cycles between the
 * native sub-boundaries.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
