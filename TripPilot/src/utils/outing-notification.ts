import i18n from '@/i18n';
import { db } from '@/data/db/database';
import {
  buildOutingNotificationPayload,
  calculateSessionTotal,
  OUTING_NOTIFICATION_TAG,
  OUTING_FOLLOWUP_TAG,
} from '@/domain/outing';
import { getActiveIntlLocale } from '@/domain/locale';
import { appSettingsRepository } from '@/data/repositories/app-settings-repository';
import { getInstallationId } from '@/utils/entity-factory';
import { safeLocalStorage } from '@/utils/safe-storage';
import type { Session } from '@/domain/types/session';
import type { OutingNotificationStrings } from '@/domain/outing';

/**
 * DEC-120 + DEC-124 (R-11 v2): active-outing notification bridge.
 *
 * The app builds the full payload (i18n labels, amounts, follow-up
 * subcategories, body templates, session limits) and shows it through the
 * SW registration. Action clicks are handled ENTIRELY by the SW (direct
 * IndexedDB write + notification re-render) — window clients only receive
 * a refresh broadcast. Delegating writes to windows proved unreliable on
 * Android (frozen tabs swallow postMessage until refocused), which is why
 * v1 notifications stayed stuck at €0.
 */

const PROMPTED_KEY = 'trippilot-outing-notification-prompted';

/** Fired after a notification-originated data change so open pages reload. */
export const OUTING_CHANGED_EVENT = 'trippilot:outing-changed';

interface SwNotificationOptions {
  tag: string;
  body: string;
  icon?: string;
  badge?: string;
  silent?: boolean;
  renotify?: boolean;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
  data?: unknown;
}

export function isOutingNotificationSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'actions' in Notification.prototype
  );
}

export function getOutingNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isOutingNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function wasOutingNotificationPrompted(): boolean {
  return safeLocalStorage.get(PROMPTED_KEY) !== null;
}

export function markOutingNotificationPrompted(): void {
  safeLocalStorage.set(PROMPTED_KEY, '1');
}

export async function requestOutingNotificationPermission(): Promise<NotificationPermission> {
  markOutingNotificationPrompted();
  return Notification.requestPermission();
}

/** DEC-124: permission AND the user toggle in Settings must both allow it. */
async function canNotify(): Promise<boolean> {
  if (!isOutingNotificationSupported() || Notification.permission !== 'granted') return false;
  const settings = await appSettingsRepository.get();
  return settings.outingNotificationEnabled;
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

function buildStrings(sessionName: string): OutingNotificationStrings {
  return {
    title: i18n.t('outing.notification_title', { name: sessionName }),
    // Placeholders are kept verbatim — the domain builder interpolates the
    // first render and the SW re-interpolates on every silent update.
    bodyNoTarget: i18n.t('outing.notification_body', { total: '{{total}}' }),
    bodyUnderTarget: i18n.t('outing.notification_body_under', {
      total: '{{total}}',
      left: '{{left}}',
    }),
    bodyOverTarget: i18n.t('outing.notification_body_over', {
      total: '{{total}}',
      over: '{{over}}',
    }),
    // `n` (not i18next's reserved `count`) — the SW interpolates {{count}}.
    drinksToTarget: i18n.t('outing.notification_drinks_left', { n: '{{count}}' }),
    openAction: i18n.t('outing.notification_open'),
    followupTitle: i18n.t('outing.notification_followup_title'),
    followupBodyTemplate: i18n.t('outing.notification_followup_body', { amount: '{{amount}}' }),
  };
}

export interface SyncOutingNotificationInput {
  session: Session;
  totalCents: number;
  currency: string;
  profileCategory: string | null;
}

/** Shows/updates (same tag, silent) the persistent active-outing notification. */
export async function syncOutingNotification(input: SyncOutingNotificationInput): Promise<void> {
  if (!(await canNotify())) return;
  const registration = await getReadyRegistration();
  if (!registration) return;

  const locale = getActiveIntlLocale();
  const payload = buildOutingNotificationPayload({
    session: input.session,
    totalCents: input.totalCents,
    currency: input.currency,
    profileCategory: input.profileCategory,
    strings: buildStrings(input.session.name),
    resolveSubcategoryLabel: (id) => i18n.t(`taxonomy.${id}` as never),
    deviceId: getInstallationId(),
    locale,
  });

  const options: SwNotificationOptions = {
    tag: payload.tag,
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    silent: true,
    renotify: false,
    requireInteraction: true,
    actions: payload.actions,
    data: {
      ...payload.data,
      currency: input.currency,
      locale,
      profileCategory: input.profileCategory,
    },
  };
  await registration.showNotification(payload.title, options as NotificationOptions);
}

export async function closeOutingNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await getReadyRegistration();
  if (!registration) return;
  const tags = [OUTING_NOTIFICATION_TAG, OUTING_FOLLOWUP_TAG];
  for (const tag of tags) {
    const notifications = await registration.getNotifications({ tag });
    notifications.forEach((n) => n.close());
  }
}

async function getActiveSessionContext(): Promise<{
  session: Session;
  currency: string;
  profileCategory: string | null;
} | null> {
  const session = await db.sessions
    .where('status')
    .equals('active')
    .filter((s) => s.deletedAt === null)
    .first();
  if (!session) return null;
  const [trip, profile] = await Promise.all([
    db.trips.get(session.tripId),
    session.activityProfileId ? db.activityProfiles.get(session.activityProfileId) : null,
  ]);
  if (!trip) return null;
  return { session, currency: trip.baseCurrency, profileCategory: profile?.category ?? null };
}

/**
 * DEC-124: re-shows the notification for whatever session is currently
 * active. Called on app boot, on tab refocus and when the Settings toggle
 * turns on — so an active outing ALWAYS has its notification, regardless
 * of which screen the user lands on.
 */
export async function syncActiveOutingNotification(): Promise<void> {
  try {
    if (!(await canNotify())) return;
    const ctx = await getActiveSessionContext();
    if (!ctx) return;
    const sessionTxs = await db.transactions.where('sessionId').equals(ctx.session.id).toArray();
    await syncOutingNotification({
      session: ctx.session,
      totalCents: calculateSessionTotal(sessionTxs),
      currency: ctx.currency,
      profileCategory: ctx.profileCategory,
    });
  } catch {
    // Notification sync must never break the app flow.
  }
}

let bridgeRegistered = false;

/**
 * Listens for SW broadcasts (data changed by a notification action) and
 * re-syncs state when the tab returns to the foreground — Android freezes
 * background tabs, so messages sent meanwhile may only land now.
 */
export function registerOutingNotificationBridge(): void {
  if (bridgeRegistered || !('serviceWorker' in navigator)) return;
  bridgeRegistered = true;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'OUTING_DATA_CHANGED') {
      window.dispatchEvent(new CustomEvent(OUTING_CHANGED_EVENT));
    } else if (
      data.type === 'OUTING_NOTIFICATION_NAVIGATE' &&
      typeof data.url === 'string' &&
      window.location.pathname !== data.url
    ) {
      window.location.assign(data.url);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      window.dispatchEvent(new CustomEvent(OUTING_CHANGED_EVENT));
      syncActiveOutingNotification();
    }
  });
}
