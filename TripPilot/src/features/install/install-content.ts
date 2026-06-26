/**
 * Item A (Distribuição & Clareza, DEC-362) — the single "Instalar o TripPilot"
 * flow. Pure, data-driven content shared by the sheet, the dedicated /install
 * page and the nudge banner. No React, no i18n here: this module only decides
 * WHAT to show; the components render it and pull copy from `install.*` keys.
 */
import { webPlatformTag } from '@/utils/platform';

/** Public Android APK (native shell). Mirrors `public/version.json` `apkUrl`. */
export const APK_URL = 'https://trippilot.pages.dev/trippilot.apk';

/** The dedicated, shareable install route. */
export const INSTALL_PATH = '/install';

export type InstallPlatform = 'android' | 'ios' | 'desktop';

/** What the flow should offer. `installed` = already running as a standalone app. */
export type InstallAudience = InstallPlatform | 'installed';

/** Resolve the install audience from the (injectable) web platform tag. */
export function installAudience(
  tag: ReturnType<typeof webPlatformTag> = webPlatformTag(),
): InstallAudience {
  if (tag === 'android-pwa' || tag === 'ios-pwa') return 'installed';
  if (tag === 'android-web') return 'android';
  if (tag === 'ios-web') return 'ios';
  return 'desktop';
}

export type SupportLevel = 'yes' | 'partial' | 'no';

/**
 * One capability row of the App(APK) × PWA × Web comparison. The label/help come
 * from i18n (`install.cmp_<id>` / `install.cmp_<id>_help`); only the support
 * matrix is data here so the table can never silently drift from the verdict.
 */
export interface ComparisonRow {
  id: string;
  app: SupportLevel;
  pwa: SupportLevel;
  web: SupportLevel;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { id: 'home_icon', app: 'yes', pwa: 'yes', web: 'no' },
  { id: 'offline', app: 'yes', pwa: 'yes', web: 'partial' },
  { id: 'notifications', app: 'yes', pwa: 'partial', web: 'no' },
  { id: 'durability', app: 'yes', pwa: 'yes', web: 'no' },
  { id: 'updates', app: 'partial', pwa: 'yes', web: 'yes' },
];

export type InstallColumn = 'app' | 'pwa' | 'web';
export type Recommendation = 'recommended' | 'ok' | 'discouraged';

/**
 * Per-column verdict. On Android the APK is the most-recommended path
 * (Julio, DEC-362 — "APK sempre o mais recomendado"); the PWA is always a solid
 * one-tap option; the bare web tab is never the recommended home for the app
 * (data can be evicted, no home icon, weakest notifications).
 */
export function columnRecommendation(
  column: InstallColumn,
  audience: InstallAudience,
): Recommendation {
  if (column === 'web') return 'discouraged';
  if (column === 'app') return audience === 'android' ? 'recommended' : 'ok';
  return audience === 'android' ? 'ok' : 'recommended';
}
