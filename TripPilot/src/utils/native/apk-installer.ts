import { registerPlugin, Capacitor } from '@capacitor/core';

import { isNativeApp } from './platform';

/**
 * DEC-210: adapter for the custom `ApkInstaller` Capacitor plugin (Android).
 *
 * OTA (Capgo) only swaps the web bundle; the native shell can only change by
 * reinstalling the APK. This bridge downloads the published APK and hands it to
 * the system package-installer (one tap, the OS still shows its own confirm —
 * we never install silently). It is a no-op on web/iOS (PWAs self-update), and
 * absent on shells older than 0.56, where the caller falls back to a plain
 * download link.
 */

export type ApkInstallResult =
  /** Download started / installer launched (the OS now shows its confirm). */
  | 'installing'
  /** "Install unknown apps" is off — we opened settings; the user retries. */
  | 'permission'
  /** Download or hand-off failed. */
  | 'failed'
  /** No native installer bridge on this platform/shell. */
  | 'unsupported';

interface ApkInstallerPlugin {
  downloadAndInstall(options: { url: string; version: string }): Promise<{ status: ApkInstallResult }>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

/** True only when the native APK installer bridge is present (Android ≥ 0.56). */
export function isApkInstallSupported(): boolean {
  return isNativeApp() && Capacitor.isPluginAvailable('ApkInstaller');
}

/**
 * Download the APK at `url` and launch the system installer. Never throws;
 * returns a discriminated result so the UI can explain the next step (grant
 * permission, retry, or fall back to a browser download).
 */
export async function downloadAndInstallApk(url: string, version: string): Promise<ApkInstallResult> {
  if (!isApkInstallSupported() || !url) return 'unsupported';
  try {
    const { status } = await ApkInstaller.downloadAndInstall({ url, version });
    return status ?? 'failed';
  } catch {
    return 'failed';
  }
}
