import { isNativeApp } from './platform';

/**
 * FIELD item 20 (G8b): boundary around `@capgo/capacitor-updater`. Every call is
 * a no-op on web/PWA (the service worker already refreshes those builds). The
 * plugin is imported dynamically so the web bundle never pulls native code, and
 * so an older APK that predates the plugin simply falls through the catch.
 *
 * No business logic lives here — the "should we update?" decision is the pure
 * `evaluateVersionStatus`; this file only performs the side effects.
 */

/**
 * Mark the running bundle as healthy. Capgo rolls a freshly-applied OTA bundle
 * back to the previous one if this is not called within `appReadyTimeout`, so we
 * call it at boot. On the builtin bundle it is harmless.
 */
export async function notifyLiveUpdateReady(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Plugin missing (older APK) or call failed — nothing to confirm.
  }
}

/** Version string of the bundle the WebView is currently serving, or null. */
export async function getCurrentBundleVersion(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const current = await CapacitorUpdater.current();
    return current?.bundle?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Download a web bundle (dist.zip) and switch the WebView to it. `set()` reloads
 * the app into the new bundle, so nothing after it runs. Guards: not native,
 * missing url, or the requested version is already the one being served. Returns
 * true only when the swap was scheduled; on any failure Capgo keeps the current
 * bundle and we stay exactly as we were (offline-first preserved).
 */
export async function downloadAndApplyBundle(
  url: string,
  version: string,
): Promise<boolean> {
  if (!isNativeApp() || !url) return false;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const current = await CapacitorUpdater.current();
    if (current?.bundle?.version === version) return false;
    const bundle = await CapacitorUpdater.download({ url, version });
    await CapacitorUpdater.set({ id: bundle.id });
    return true;
  } catch {
    return false;
  }
}
