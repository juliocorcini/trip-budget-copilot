import { isNativeApp } from './platform';
import type { OutingNotificationPayload } from '@/domain/outing';

/**
 * N6 (Gate 1B): native notification boundary (Android, Capacitor
 * LocalNotifications). Replaces the Service Worker + Web Notifications path that
 * the WebView cannot serve ("this browser does not support notifications with
 * buttons"). Base scope: real permission flow + an ongoing active-outing
 * notification with a working "open" action. The interactive quick-add buttons
 * (writing to the DB from the notification) belong to Track B / the Live Update
 * spec, where they get a foreground service and on-device validation.
 *
 * The plugin is imported lazily so the Web bundle and the unit tests never load
 * native code (every entry point is guarded by `isNativeApp()`).
 */

const OUTING_NOTIFICATION_ID = 1001;
const OUTING_ACTION_TYPE = 'TRIPPILOT_OUTING';
const OUTING_ROUTE = '/outings/active';

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
let actionListenerBound = false;

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

/** Shows or updates (same id) the ongoing active-outing notification. */
export async function showOutingNotification(payload: OutingNotificationPayload): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  const plugin = holder.plugin;
  const openTitle = payload.actions.find((a) => a.action === 'open')?.title ?? 'Open';
  try {
    await plugin.registerActionTypes({
      types: [{ id: OUTING_ACTION_TYPE, actions: [{ id: 'open', title: openTitle }] }],
    });
    await plugin.schedule({
      notifications: [
        {
          id: OUTING_NOTIFICATION_ID,
          title: payload.title,
          body: payload.body,
          ongoing: true,
          autoCancel: false,
          actionTypeId: OUTING_ACTION_TYPE,
        },
      ],
    });
  } catch {
    // Notification delivery must never break the app flow.
  }
}

export async function closeOutingNotification(): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  try {
    await holder.plugin.cancel({ notifications: [{ id: OUTING_NOTIFICATION_ID }] });
  } catch {
    // nothing to cancel — ignore.
  }
}

/**
 * Boot-time setup: caches the current permission and binds the action listener
 * so tapping the notification (body or "open") brings the active outing up.
 */
export async function initNativeNotifications(): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  void refreshNotificationPermission();
  if (actionListenerBound) return;
  actionListenerBound = true;
  try {
    await holder.plugin.addListener('localNotificationActionPerformed', () => {
      if (window.location.pathname !== OUTING_ROUTE) {
        window.location.assign(OUTING_ROUTE);
      }
    });
  } catch {
    actionListenerBound = false;
  }
}
