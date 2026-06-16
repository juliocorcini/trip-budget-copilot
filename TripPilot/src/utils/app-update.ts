import { APP_VERSION } from '@/utils/app-version';
import { isNativeApp } from '@/utils/native/platform';
import {
  evaluateVersionStatus,
  parseVersionManifest,
  type VersionManifest,
  type VersionStatus,
} from '@/domain/version';

/**
 * FIELD item 20 (G8a): boundary for version awareness. Fetches the remote
 * manifest (absolute URL — in the APK a relative path would resolve to the
 * BUNDLED copy and defeat the purpose), reads the installed APK version, and
 * delegates the actual decision to the pure `evaluateVersionStatus`.
 *
 * This does NOT update anything by itself — that is the live-updater's job
 * (G8b). Here we only tell the traveler the honest state.
 */

const DEFAULT_MANIFEST_URL = 'https://trippilot.pages.dev/version.json';

export function versionManifestUrl(): string {
  return import.meta.env.VITE_VERSION_MANIFEST_URL ?? DEFAULT_MANIFEST_URL;
}

/** Installed APK version via `@capacitor/app`; null on web/PWA or on failure. */
export async function getNativeAppVersion(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return info.version ?? null;
  } catch {
    return null;
  }
}

/** Fetch + validate the published manifest; null when offline/unreachable. */
export async function fetchVersionManifest(): Promise<VersionManifest | null> {
  try {
    const response = await fetch(versionManifestUrl(), { cache: 'no-store' });
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    return parseVersionManifest(raw);
  } catch {
    return null;
  }
}

/**
 * Resolve the full version status: this build's web version vs. the installed
 * APK vs. what the server publishes. Native version and manifest are fetched in
 * parallel since they are independent.
 */
export async function resolveAppVersionStatus(): Promise<VersionStatus> {
  const [nativeVersion, manifest] = await Promise.all([
    getNativeAppVersion(),
    fetchVersionManifest(),
  ]);
  return evaluateVersionStatus({ webVersion: APP_VERSION, nativeVersion, manifest });
}
