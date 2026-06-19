import i18n from '@/i18n';
import { formatMoney } from '@/domain/money';
import { isNativeApp } from '@/utils/native/platform';
import { safeLocalStorage } from '@/utils/safe-storage';
import {
  loadActiveSplitMeta,
  SPLIT_LIVE_CHANGED_EVENT,
  type ActiveSplitMeta,
} from '@/features/split/live-link';
import {
  hasNotificationPermission as hasNativeNotificationPermission,
  requestNotificationPermission as requestNativeNotificationPermission,
} from '@/utils/native/notifications';
import { showSplitNotifier, cancelSplitNotifier } from '@/utils/native/split-notifier';

/**
 * "A divisão é como uma saída que está acontecendo" — a single persistent
 * notification that mirrors the active live split. Unlike the active-outing
 * notification (which writes expenses straight from the Service Worker), this one
 * is purely informational: it shows the table name + total + who's in, updates
 * silently as people join/claim, and a tap deep-links back into the table. No SW
 * database writes, so it reuses the existing notification surfaces with almost no
 * new moving parts.
 *
 * Web → the Service Worker `showNotification`; the click is handled by the SW
 * (SPLIT_TAG → focusOrOpen('/split/scan'), reusing the navigate bridge already
 * registered for outings). Native → the LocalNotifications ongoing notification.
 */

/** MUST match the tag the Service Worker switches on (public/sw.js). */
const SPLIT_TAG = 'trippilot-active-split';
const PROMPTED_KEY = 'trippilot-split-notification-prompted';

function isWebNotifySupported(): boolean {
  return 'serviceWorker' in navigator && 'Notification' in window;
}

export function isSplitNotificationSupported(): boolean {
  if (isNativeApp()) return true;
  return isWebNotifySupported();
}

async function canNotify(): Promise<boolean> {
  if (isNativeApp()) return hasNativeNotificationPermission();
  return isWebNotifySupported() && Notification.permission === 'granted';
}

export function wasSplitNotificationPrompted(): boolean {
  return safeLocalStorage.get(PROMPTED_KEY) !== null;
}

/**
 * Ask for notification permission — call ONLY from a user gesture (e.g. the tap
 * that starts the live table), since the web prompt needs user activation. Idempotent.
 */
export async function requestSplitNotificationPermission(): Promise<void> {
  if (wasSplitNotificationPrompted()) return;
  safeLocalStorage.set(PROMPTED_KEY, '1');
  try {
    if (isNativeApp()) {
      await requestNativeNotificationPermission();
    } else if (isWebNotifySupported() && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch {
    // never let a permission prompt break the flow
  }
  // Surface the notification immediately if a table is already live + allowed.
  await syncSplitNotification();
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

function buildBody(meta: ActiveSplitMeta): string {
  const total = formatMoney(meta.totalCents, meta.currency);
  const people =
    meta.guestCount > 0
      ? i18n.t('splitTable.guests_joined', { count: meta.guestCount })
      : i18n.t('splitTable.waiting_guests');
  return i18n.t('splitTable.notification_body', { total, people });
}

function buildTitle(meta: ActiveSplitMeta): string {
  return i18n.t('splitTable.notification_title', { name: meta.name || i18n.t('split.default_name') });
}

/** Show/update the persistent notification for the current active split. */
async function showFor(meta: ActiveSplitMeta): Promise<void> {
  const title = buildTitle(meta);
  const body = buildBody(meta);

  if (isNativeApp()) {
    await showSplitNotifier({ title, body });
    return;
  }
  const registration = await getReadyRegistration();
  if (!registration) return;
  await registration.showNotification(title, {
    tag: SPLIT_TAG,
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    silent: true,
    requireInteraction: true,
    data: { kind: 'split', url: '/split/scan' },
  } as NotificationOptions);
}

export async function clearSplitNotification(): Promise<void> {
  if (isNativeApp()) {
    await cancelSplitNotifier();
    return;
  }
  if (!('serviceWorker' in navigator)) return;
  const registration = await getReadyRegistration();
  if (!registration) return;
  const notifications = await registration.getNotifications({ tag: SPLIT_TAG });
  notifications.forEach((n) => n.close());
}

/**
 * Reconcile the notification with the current active-split snapshot: show/update
 * it when a table is live and allowed, clear it otherwise. Safe to call on any
 * change event, on resume, and on boot.
 */
export async function syncSplitNotification(): Promise<void> {
  try {
    const meta = loadActiveSplitMeta();
    if (!meta) {
      await clearSplitNotification();
      return;
    }
    if (!(await canNotify())) return;
    await showFor(meta);
  } catch {
    // notification sync must never break the app flow
  }
}

let bridgeRegistered = false;

/**
 * Keep the persistent split notification in step with the live table from
 * anywhere in the app: on the in-app change event (owner edit / guest join), on
 * tab refocus, and on boot. Registered once at startup (main.tsx).
 */
export function registerSplitNotificationBridge(): void {
  if (bridgeRegistered) return;
  bridgeRegistered = true;

  const sync = () => void syncSplitNotification();
  window.addEventListener(SPLIT_LIVE_CHANGED_EVENT, sync);
  window.addEventListener('storage', sync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync();
  });
  sync();
}
