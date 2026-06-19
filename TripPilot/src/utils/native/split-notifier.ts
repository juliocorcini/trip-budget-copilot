import { isNativeApp } from './platform';

/**
 * Native (Android, Capacitor LocalNotifications) renderer for the persistent
 * "live bill split is happening" notification — the split's counterpart of the
 * active-outing notifier. It is a single ongoing notification (one stable id)
 * that we re-`schedule` to update silently and `cancel` when the table ends.
 *
 * The plugin is imported lazily and wrapped in a plain holder so Capacitor's
 * thenable proxy never gets awaited directly (the boot crash documented in
 * native/notifications.ts).
 */

type LocalNotificationsPlugin = typeof import('@capacitor/local-notifications')['LocalNotifications'];

interface PluginHolder {
  plugin: LocalNotificationsPlugin;
}

/** Stable id for the single ongoing split notification. */
const SPLIT_NOTIFICATION_ID = 778_801;

async function loadPlugin(): Promise<PluginHolder | null> {
  if (!isNativeApp()) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    return { plugin: mod.LocalNotifications };
  } catch {
    return null;
  }
}

export async function showSplitNotifier(input: { title: string; body: string }): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  try {
    await holder.plugin.schedule({
      notifications: [
        {
          id: SPLIT_NOTIFICATION_ID,
          title: input.title,
          body: input.body,
          // Persistent while the division is live: not swipe-dismissable and not
          // cleared by a tap (the tap deep-links into the table instead).
          ongoing: true,
          autoCancel: false,
        },
      ],
    });
  } catch {
    // Notification rendering must never break the split flow.
  }
}

export async function cancelSplitNotifier(): Promise<void> {
  const holder = await loadPlugin();
  if (!holder) return;
  try {
    await holder.plugin.cancel({ notifications: [{ id: SPLIT_NOTIFICATION_ID }] });
  } catch {
    // best-effort
  }
}
