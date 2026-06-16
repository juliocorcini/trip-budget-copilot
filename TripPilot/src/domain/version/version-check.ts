/**
 * FIELD item 20 (G8a): version awareness. Pure, dependency-free logic so the UI
 * (and the native live-updater later) can ask a single honest question:
 * "given my web bundle version, my installed APK version, and what the server
 * publishes, what is the real state?"
 *
 * The web bundle (HTML/CSS/JS) is what OTA can refresh; the APK (native shell)
 * can only change by reinstalling. So a newer web bundle is reachable over the
 * air ONLY when the installed APK is recent enough — otherwise the traveler must
 * grab a new APK. This module encodes exactly that decision.
 */

/** What the server publishes at `/version.json` (all but `version` optional). */
export interface VersionManifest {
  /** Latest published web bundle version (semver "x.y.z"). */
  version: string;
  /** Minimum native APK version required to run that web bundle. */
  requiredNativeVersion?: string;
  /**
   * The versionName of the APK currently published at `apkUrl`. Lets the app
   * tell the traveler a newer APK exists even when it is not strictly required
   * by the bundle (DEC-210 — native self-update).
   */
  latestNativeVersion?: string;
  /** Where to download a fresh APK when the installed one is too old. */
  apkUrl?: string;
  /** Where the OTA web bundle (dist.zip) for `version` lives — G8b live-update. */
  bundleUrl?: string;
  /** Short human note about the release. */
  notes?: string;
}

export interface AppVersionInput {
  /** This build's web bundle version (the `APP_VERSION` constant). */
  webVersion: string;
  /** Installed APK version (from `@capacitor/app`), or null on web/PWA. */
  nativeVersion: string | null;
  /** Parsed manifest, or null when it could not be fetched/parsed. */
  manifest: VersionManifest | null;
}

export type VersionStatusKind =
  /** Manifest missing/unreadable — we cannot tell. */
  | 'unknown'
  /** Running the latest web bundle (or newer). Nothing to do. */
  | 'up_to_date'
  /** A newer web bundle exists and the current APK can run it (OTA-eligible). */
  | 'web_update_available'
  /** A newer web bundle exists but the installed APK is too old → reinstall. */
  | 'apk_outdated';

export interface VersionStatus {
  kind: VersionStatusKind;
  /** Latest web version per the manifest (echoes input when unknown). */
  latestWeb: string;
  /** APK version required by the latest bundle, when declared. */
  requiredNative: string | null;
  /** Latest published APK versionName per the manifest, when declared. */
  latestNative: string | null;
  /** The installed APK version, when known. */
  nativeVersion: string | null;
  /**
   * True when running inside an APK whose installed version is older than the
   * latest published APK — i.e. a fresh APK can be installed (DEC-210). This is
   * orthogonal to `kind`: a newer APK may exist even while the web bundle is
   * up to date, so the UI can offer "update the app" independently.
   */
  nativeUpdateAvailable: boolean;
  /** APK download link, when the manifest declares one. */
  apkUrl: string | null;
  /** OTA web-bundle (dist.zip) link, when the manifest declares one (G8b). */
  bundleUrl: string | null;
}

/**
 * Compare two dotted version strings numerically segment-by-segment.
 * Tolerant of missing segments ("1.2" == "1.2.0") and non-numeric junk
 * (treated as 0). Returns -1 if a<b, 0 if equal, 1 if a>b.
 */
export function compareSemver(a: string, b: string): number {
  const segments = (value: string): number[] =>
    String(value)
      .trim()
      .split('.')
      .map((part) => {
        const n = parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });

  const left = segments(a);
  const right = segments(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** True when `candidate` is strictly newer than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  return compareSemver(candidate, current) > 0;
}

/**
 * Decide the honest version state. The native-vs-OTA branch only matters when a
 * newer bundle exists AND we know the installed APK version AND the manifest
 * declares the minimum APK it needs.
 */
export function evaluateVersionStatus(input: AppVersionInput): VersionStatus {
  const { webVersion, nativeVersion, manifest } = input;

  if (!manifest || !manifest.version) {
    return {
      kind: 'unknown',
      latestWeb: webVersion,
      requiredNative: null,
      latestNative: null,
      nativeVersion,
      nativeUpdateAvailable: false,
      apkUrl: null,
      bundleUrl: null,
    };
  }

  const requiredNative = manifest.requiredNativeVersion ?? null;
  const latestNative = manifest.latestNativeVersion ?? null;
  const apkUrl = manifest.apkUrl ?? null;
  const bundleUrl = manifest.bundleUrl ?? null;

  // A fresh APK can be installed when we know our installed version, the
  // manifest names a published one, and that one is strictly newer.
  const nativeUpdateAvailable =
    nativeVersion !== null &&
    latestNative !== null &&
    compareSemver(latestNative, nativeVersion) > 0;

  if (!isNewerVersion(manifest.version, webVersion)) {
    return {
      kind: 'up_to_date',
      latestWeb: manifest.version,
      requiredNative,
      latestNative,
      nativeVersion,
      nativeUpdateAvailable,
      apkUrl,
      bundleUrl,
    };
  }

  // A newer web bundle exists. If we're inside the APK and it predates what the
  // bundle requires, OTA cannot safely apply it — the traveler needs a new APK.
  const apkTooOld =
    nativeVersion !== null &&
    requiredNative !== null &&
    compareSemver(nativeVersion, requiredNative) < 0;

  return {
    kind: apkTooOld ? 'apk_outdated' : 'web_update_available',
    latestWeb: manifest.version,
    requiredNative,
    latestNative,
    nativeVersion,
    nativeUpdateAvailable,
    apkUrl,
    bundleUrl,
  };
}

/** Narrowing guard for an unknown JSON payload fetched from the manifest URL. */
export function parseVersionManifest(raw: unknown): VersionManifest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.version !== 'string' || candidate.version.trim() === '') {
    return null;
  }
  const manifest: VersionManifest = { version: candidate.version.trim() };
  if (typeof candidate.requiredNativeVersion === 'string') {
    manifest.requiredNativeVersion = candidate.requiredNativeVersion.trim();
  }
  if (typeof candidate.latestNativeVersion === 'string') {
    manifest.latestNativeVersion = candidate.latestNativeVersion.trim();
  }
  if (typeof candidate.apkUrl === 'string') {
    manifest.apkUrl = candidate.apkUrl.trim();
  }
  if (typeof candidate.bundleUrl === 'string') {
    manifest.bundleUrl = candidate.bundleUrl.trim();
  }
  if (typeof candidate.notes === 'string') {
    manifest.notes = candidate.notes;
  }
  return manifest;
}
