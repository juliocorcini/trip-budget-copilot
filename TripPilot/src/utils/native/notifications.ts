import { isNativeApp } from './platform';

/**
 * Native notification PERMISSION boundary (Android, Capacitor LocalNotifications).
 * The active-outing notification itself is now rendered by the custom plugins
 * (Live Update on SDK >= 36, OutingNotifier below that); this module only owns
 * the runtime permission flow, which both paths gate on.
 *
 * The plugin is imported lazily so the Web bundle and the unit tests never load
 * native code (every entry point is guarded by `isNativeApp()`).
 */

type LocalNotificationsPlugin = typeof import('@capacitor/local-notifications')['LocalNotifications'];

// Capacitor's registerPlugin proxy traps EVERY property access, so the plugin
// object looks "thenable" (`plugin.then` resolves to a function). Returning it
// directly from an async function makes the Promise machinery call `.then()` on
// it, and Capacitor throws `"LocalNotifications.then()" is not implemented on
// android`. That was the boot/visibility crash loop that left notifications
// permanently broken. Wrapping the plugin in a plain holder keeps the resolved
// value non-thenable.
interface PluginHolder {
  plugin: LocalNotificationsPlugin;
}

let cachedPermission: NotificationPermission = 'default';

async function loadPlugin(): Promise<PluginHolder | null> {
  if (!isNativeApp()) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    return { plugin: mod.LocalNotifications };
  } catch {
    return null;
  }
}

function mapDisplayState(state: string): NotificationPermission {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  return 'default';
}

export function getCachedNotificationPermission(): NotificationPermission {
  return cachedPermission;
}

export async function refreshNotificationPermission(): Promise<NotificationPermission> {
  const holder = await loadPlugin();
  if (!holder) return cachedPermission;
  try {
    const status = await holder.plugin.checkPermissions();
    cachedPermission = mapDisplayState(status.display);
  } catch {
    // keep the previous value — never throw from a permission probe.
  }
  return cachedPermission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const holder = await loadPlugin();
  if (!holder) return cachedPermission;
  try {
    const status = await holder.plugin.requestPermissions();
    cachedPermission = mapDisplayState(status.display);
  } catch {
    // keep the previous value.
  }
  return cachedPermission;
}

export async function hasNotificationPermission(): Promise<boolean> {
  await refreshNotificationPermission();
  return cachedPermission === 'granted';
}

/** Boot-time setup: caches the current notification permission. */
export async function initNativeNotifications(): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  void refreshNotificationPermission();
}
