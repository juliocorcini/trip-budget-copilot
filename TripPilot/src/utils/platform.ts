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
 * DEC-253 + FB-20 (DEC-271): the real platform tag reported to telemetry for a
 * NON-native (web/PWA) build. `Capacitor.getPlatform()` returns `'web'` for every
 * non-native shell — including the iPhone/iPad PWA — which made every iOS web
 * user show up as "WEB". This derives the actual OS from the UA AND distinguishes
 * an installed PWA (standalone display mode) from a browser tab, so the admin
 * "Plataformas" distribution separates Android/iOS · web vs PWA. Pure (every
 * input is injectable) so it is unit-testable without a real browser.
 *
 *   - iPhone / iPad, browser tab        → 'ios-web'
 *   - iPhone / iPad, installed PWA       → 'ios-pwa'
 *   - Android phone/tablet, browser tab  → 'android-web'
 *   - Android phone/tablet, installed PWA→ 'android-pwa'
 *   - everything else (desktop browsers) → 'web'
 *
 * The native shells are handled by the caller (Capacitor reports 'ios'/'android'
 * directly), so this only ever classifies the web build.
 */
export function webPlatformTag(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform: string = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
  standalone: boolean = typeof window !== 'undefined' ? isStandaloneDisplayMode() : false,
): 'ios-web' | 'ios-pwa' | 'android-web' | 'android-pwa' | 'web' {
  const classicIos = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as MacIntel with touch support (same heuristic as isIosDevice).
  const iPadOs = platform === 'MacIntel' && maxTouchPoints > 1;
  if (classicIos || iPadOs) return standalone ? 'ios-pwa' : 'ios-web';
  if (/Android/i.test(ua)) return standalone ? 'android-pwa' : 'android-web';
  return 'web';
}

/**
 * FB-05 (DEC-266): a friendly default device name when the traveler leaves the
 * field blank. We use the OS + browser FAMILY (never the raw model string, which
 * is technical and often unavailable on the web) so the name reads like "Android
 * · Chrome" / "iPhone · Safari". Pure (UA injectable) for unit tests; falls back
 * to a generic label when nothing is recognizable. Also reused by FB-20/FB-21.
 */
export function deviceBrowserFamily(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): string | null {
  // Order matters: Edge/Opera/Samsung/Chrome-iOS all carry a "Chrome" token, so
  // they must be matched before the generic Chrome check; Safari is matched last
  // (its UA token also appears in Chrome's).
  if (/Edg(A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera|OPiOS/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/CriOS\//.test(ua)) return 'Chrome';
  if (/Chrome\/|Chromium\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  return null;
}

export function deviceOsLabel(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform: string = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
): string | null {
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows|Win32|Win64/.test(ua) || platform === 'Win32') return 'Windows';
  if (/Macintosh|Mac OS X/.test(ua) || platform === 'MacIntel') return 'Mac';
  if (/Linux|X11|CrOS/.test(ua)) return 'Linux';
  return null;
}

export function suggestDeviceName(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform: string = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
): string {
  const os = deviceOsLabel(ua, platform, maxTouchPoints);
  const browser = deviceBrowserFamily(ua);
  if (os && browser) return `${os} · ${browser}`;
  return os ?? browser ?? 'Meu dispositivo';
}
