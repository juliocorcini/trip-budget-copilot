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

export const ALERT_CHANNEL_ID = 'trippilot_alerts';

/** Boot-time setup: caches the current notification permission, creates channels, and listens for taps. */
export async function initNativeNotifications(): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  void refreshNotificationPermission();
  try {
    await holder.plugin.createChannel({
      id: ALERT_CHANNEL_ID,
      name: 'Payments & alerts',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'default',
    });
  } catch {
    // Channel creation is best-effort.
  }
  holder.plugin.addListener(
    'localNotificationActionPerformed',
    (action) => {
      const deepLink = action.notification.extra?.deepLink as string | undefined;
      if (deepLink) {
        window.location.assign(deepLink);
      }
    },
  );
}

const ONGOING_GROUP_SPLIT_ID = 778_802;

/**
 * Show a persistent (ongoing) notification that cannot be swiped away.
 * Used for pending group-split payments that require owner action.
 * Re-calling with different text updates the notification in place.
 */
export async function showOngoingGroupSplitNotification(
  title: string,
  body: string,
  deepLink?: string,
): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  if (cachedPermission !== 'granted') {
    const updated = await refreshNotificationPermission();
    if (updated !== 'granted') return;
  }
  try {
    await holder.plugin.schedule({
      notifications: [{
        id: ONGOING_GROUP_SPLIT_ID,
        title,
        body,
        smallIcon: 'ic_notification',
        channelId: ALERT_CHANNEL_ID,
        ongoing: true,
        autoCancel: false,
        extra: deepLink ? { deepLink } : undefined,
      }],
    });
  } catch {
    // best-effort
  }
}

export async function cancelOngoingGroupSplitNotification(): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  try {
    await holder.plugin.cancel({ notifications: [{ id: ONGOING_GROUP_SPLIT_ID }] });
  } catch {
    // best-effort
  }
}

/**
 * DEC-352 (F18, G6) — fire a one-off OS notification (e.g. a peer-ping delivered
 * a charge while the app was backgrounded). Native + granted-permission only;
 * a no-op on the web and fully best-effort (never throws). Android notification
 * ids must fit a 32-bit int.
 *
 * @param deepLink — optional in-app route (e.g. `/groups/abc`) to navigate to on tap.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  deepLink?: string,
): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  if (cachedPermission !== 'granted') {
    const updated = await refreshNotificationPermission();
    if (updated !== 'granted') return;
  }
  try {
    await holder.plugin.schedule({
      notifications: [{
        id: Date.now() % 2_000_000_000,
        title,
        body,
        smallIcon: 'ic_notification',
        channelId: ALERT_CHANNEL_ID,
        extra: deepLink ? { deepLink } : undefined,
      }],
    });
  } catch {
    // best-effort — a failed notification must never disrupt the drain
  }
}
