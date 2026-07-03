/**
 * DEC-444 (PWA-1/2) — pure, data-driven manual-install guide selector.
 *
 * `beforeinstallprompt` is a Chromium-only, heuristic-gated event: when the
 * browser refuses to fire it (Firefox/Samsung/desktop-Safari, engagement
 * heuristics, already-dismissed) programmatic install is a platform ceiling —
 * no code can force it. The honest fallback is a per-browser step-by-step.
 * This module picks WHICH guide to show; the copy lives in i18n (pt/en/es).
 * Pure (browser/OS injected) so every mapping is unit-testable.
 */

export type InstallGuideFamily =
  | 'chrome-android'
  | 'edge-android'
  | 'samsung-android'
  | 'firefox-android'
  | 'desktop'
  | 'generic';

const ANDROID_FAMILY_BY_BROWSER: Record<string, InstallGuideFamily> = {
  Chrome: 'chrome-android',
  Edge: 'edge-android',
  'Samsung Internet': 'samsung-android',
  Firefox: 'firefox-android',
};

const DESKTOP_CHROMIUM = new Set(['Chrome', 'Edge', 'Opera']);

/**
 * Maps the detected browser family (`deviceBrowserFamily`) + platform to the
 * guide to render. iOS never reaches here (it has the Safari infographic).
 */
export function resolveInstallGuideFamily(input: {
  browser: string | null;
  isAndroid: boolean;
}): InstallGuideFamily {
  if (input.isAndroid) return ANDROID_FAMILY_BY_BROWSER[input.browser ?? ''] ?? 'generic';
  return DESKTOP_CHROMIUM.has(input.browser ?? '') ? 'desktop' : 'generic';
}

const I18N_FAMILY_KEY: Record<InstallGuideFamily, string> = {
  'chrome-android': 'chrome_android',
  'edge-android': 'edge_android',
  'samsung-android': 'samsung_android',
  'firefox-android': 'firefox_android',
  desktop: 'desktop',
  generic: 'generic',
};

const STEP_COUNT: Record<InstallGuideFamily, number> = {
  'chrome-android': 3,
  'edge-android': 3,
  'samsung-android': 3,
  'firefox-android': 3,
  desktop: 2,
  generic: 3,
};

/** i18n title key for a guide family (e.g. `install.guide.chrome_android.title`). */
export function manualInstallTitleKey(family: InstallGuideFamily): string {
  return `install.guide.${I18N_FAMILY_KEY[family]}.title`;
}

/** Ordered i18n step keys for a guide family (`install.guide.<family>.step1..N`). */
export function manualInstallStepKeys(family: InstallGuideFamily): string[] {
  const base = `install.guide.${I18N_FAMILY_KEY[family]}`;
  return Array.from({ length: STEP_COUNT[family] }, (_, index) => `${base}.step${index + 1}`);
}
