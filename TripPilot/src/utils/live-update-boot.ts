import i18n from '@/i18n';
import { resolveAppVersionStatus } from '@/utils/app-update';
import {
  notifyLiveUpdateReady,
  downloadAndApplyBundle,
} from '@/utils/native/live-update';
import { downloadAndInstallApk, isApkInstallSupported } from '@/utils/native/apk-installer';
import { isNativeApp } from '@/utils/native/platform';
import { showToast } from '@/components/Toast';

/**
 * FIELD item 20 (G8b): drives Capgo live-updates from outside React, mirroring
 * the mailbox boot model ("arrives on next app open"). On a cold start it:
 *   1. confirms the running bundle is healthy so a previously-applied OTA update
 *      is committed and never rolled back, then
 *   2. asks the published manifest and — only when a newer web bundle exists AND
 *      the installed APK is recent enough to run it — pulls the dist.zip from
 *      Pages and swaps it in (which reloads).
 *
 * The "APK too old" case is intentionally silent here (the honest manifest check
 * in Settings already explains it); auto-applying mid-session is avoided by
 * running on cold start only — a resume never re-runs this module.
 */

let started = false;

async function runLiveUpdateCheck(): Promise<void> {
  try {
    const status = await resolveAppVersionStatus();
    if (status.kind === 'web_update_available' && status.bundleUrl) {
      // Web bundles apply silently (set() reloads into the new bundle).
      await downloadAndApplyBundle(status.bundleUrl, status.latestWeb);
      return;
    }
    // DEC-210: a newer APK shell exists. We cannot install it silently (the OS
    // requires the user's confirm), and a ~20 MB auto-download on every boot
    // would be hostile — so we nudge with a one-tap toast instead.
    if (status.nativeUpdateAvailable && status.apkUrl && isApkInstallSupported()) {
      const apkUrl = status.apkUrl;
      const version = status.latestNative ?? status.latestWeb;
      showToast(i18n.t('settings.update_native_available'), 'info', {
        durationMs: 12000,
        onTap: () => {
          void downloadAndInstallApk(apkUrl, version);
        },
      });
    }
  } catch {
    // Offline or manifest unreachable — try again on the next cold start.
  }
}

export function registerLiveUpdate(): void {
  if (!isNativeApp() || started) return;
  started = true;
  // Commit the current bundle ASAP (within Capgo's appReadyTimeout window).
  void notifyLiveUpdateReady();
  // Defer the network check so it never competes with first paint.
  window.setTimeout(() => void runLiveUpdateCheck(), 2500);
}
