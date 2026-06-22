/**
 * R6-13 (R5-03): platform detection for the persistence story. On iOS,
 * navigator.storage.persist() never prompts and almost always returns false —
 * real protection comes from installing the PWA to the home screen.
 */

export function isIosDevice(): boolean {
  const ua = navigator.userAgent;
  const classicIos = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as MacIntel with touch support.
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return classicIos || iPadOs;
}

export function isStandaloneDisplayMode(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

/**
 * DEC-253: the real OS tag reported to telemetry for a NON-native (web/PWA)
 * build. `Capacitor.getPlatform()` returns `'web'` for every non-native shell —
 * INCLUDING the iPhone/iPad PWA — which made every iOS web user show up as
 * "WEB" in the admin panel. This derives the actual OS from the UA so the
 * "Plataformas" distribution is honest. Pure (every input is injectable) so it
 * is unit-testable without a real browser.
 *
 *   - iPhone / iPad (Safari or installed PWA) → 'ios-web'
 *   - Android phone/tablet                    → 'android-web'
 *   - everything else (desktop browsers)      → 'web'
 *
 * The native shells are handled by the caller (Capacitor reports 'ios'/'android'
 * directly), so this only ever classifies the web build.
 */
export function webPlatformTag(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform: string = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
): 'ios-web' | 'android-web' | 'web' {
  const classicIos = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as MacIntel with touch support (same heuristic as isIosDevice).
  const iPadOs = platform === 'MacIntel' && maxTouchPoints > 1;
  if (classicIos || iPadOs) return 'ios-web';
  if (/Android/i.test(ua)) return 'android-web';
  return 'web';
}
