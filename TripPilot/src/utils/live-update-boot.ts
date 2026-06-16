import { resolveAppVersionStatus } from '@/utils/app-update';
import {
  notifyLiveUpdateReady,
  downloadAndApplyBundle,
} from '@/utils/native/live-update';
import { isNativeApp } from '@/utils/native/platform';

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
      await downloadAndApplyBundle(status.bundleUrl, status.latestWeb);
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
