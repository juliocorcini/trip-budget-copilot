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
import { isNativeApp } from '@/utils/native/platform';
import { formatMoney } from '@/domain/money';
import {
  hasNotificationPermission as hasNativeNotificationPermission,
  requestNotificationPermission as requestNativeNotificationPermission,
  refreshNotificationPermission as refreshNativeNotificationPermission,
  getCachedNotificationPermission as getCachedNativeNotificationPermission,
} from '@/utils/native/notifications';
import {
  showOutingNotifier,
  cancelOutingNotifier,
  drainOutingQuickAdds,
  addOutingQuickAddListener,
} from '@/utils/native/outing-notifier';
import {
  isLiveOutingSupported,
  syncLiveOuting,
  endLiveOuting,
} from '@/utils/native/live-outing';
import { quickAddSessionExpense } from '@/domain/orchestrators';
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
const DEFAULT_NOTIFICATION_ACCENT = '#C75B39';

/** Fired after a notification-originated data change so open pages reload. */
export const OUTING_CHANGED_EVENT = 'trippilot:outing-changed';

/** Reads the live theme accent (--primary) for the native notification color. */
function readNotificationAccent(): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    return value || DEFAULT_NOTIFICATION_ACCENT;
  } catch {
    return DEFAULT_NOTIFICATION_ACCENT;
  }
}

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
  // N6: the APK serves notifications natively (LocalNotifications), so the
  // WebView's missing Notification API no longer means "unsupported".
  if (isNativeApp()) return true;
  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'actions' in Notification.prototype
  );
}

export function getOutingNotificationPermission(): NotificationPermission | 'unsupported' {
  if (isNativeApp()) return getCachedNativeNotificationPermission();
  if (!isOutingNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/** N6: native permission is async — refresh the cache and report it (Settings). */
export async function refreshOutingNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (isNativeApp()) return refreshNativeNotificationPermission();
  return getOutingNotificationPermission();
}

export function wasOutingNotificationPrompted(): boolean {
  return safeLocalStorage.get(PROMPTED_KEY) !== null;
}

export function markOutingNotificationPrompted(): void {
  safeLocalStorage.set(PROMPTED_KEY, '1');
}

export async function requestOutingNotificationPermission(): Promise<NotificationPermission> {
  markOutingNotificationPrompted();
  if (isNativeApp()) return requestNativeNotificationPermission();
  return Notification.requestPermission();
}

/** DEC-124: permission AND the user toggle in Settings must both allow it. */
async function canNotify(): Promise<boolean> {
  const settings = await appSettingsRepository.get();
  if (!settings.outingNotificationEnabled) return false;
  if (isNativeApp()) return hasNativeNotificationPermission();
  return isOutingNotificationSupported() && Notification.permission === 'granted';
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

  // N6: the APK renders the notification natively; the Web/PWA keeps the
  // Service Worker path (rich actions handled entirely by the SW).
  if (isNativeApp()) {
    // B1/B2 (Gate 4): on Android 16+ the active outing is owned by the Live
    // Update (promoted ongoing + status-bar chip + Now Bar). Older devices fall
    // back to the rich OutingNotifier with quick-add value buttons (N5/N6).
    if (await isLiveOutingSupported()) {
      await syncLiveOuting({
        title: payload.title,
        body: payload.body,
        statusText: formatMoney(input.totalCents, input.currency),
        totalCents: input.totalCents,
        targetCents: payload.data.targetCents,
      });
      return;
    }
    // N5: the notification carries up to 3 of the session's quick-add values —
    // the SAME amounts as the active-outing screen — so a tap logs an expense
    // without opening the app. Capped at 3 (Android's action-button budget);
    // the SW payload still uses 2 (it must keep room for "open").
    const quickValues = input.session.quickAddValuesCents
      .filter((v) => v > 0)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 3);
    await showOutingNotifier({
      title: payload.title,
      accentColor: readNotificationAccent(),
      totalCents: input.totalCents,
      targetCents: payload.data.targetCents ?? -1,
      avgDrinkCents: payload.data.avgDrinkPriceCents ?? -1,
      locale,
      currency: input.currency,
      tplNoTarget: payload.data.strings.bodyNoTarget,
      tplUnder: payload.data.strings.bodyUnderTarget,
      tplOver: payload.data.strings.bodyOverTarget,
      tplDrinks: payload.data.strings.drinksToTarget,
      quickAdds: quickValues.map((value) => ({
        amountCents: value,
        label: `+${formatMoney(value, input.currency, locale)}`,
      })),
    });
    return;
  }

  const registration = await getReadyRegistration();
  if (!registration) return;

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
  if (isNativeApp()) {
    if (await isLiveOutingSupported()) {
      await endLiveOuting();
      return;
    }
    // Drain any last button taps into real expenses before tearing the
    // notification down, so a tap right before "end outing" is never lost.
    await reconcileOutingQuickAdds();
    await cancelOutingNotifier();
    return;
  }
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

/**
 * N5/N6: drains the queue of quick-add taps the active-outing notification
 * logged while the app was backgrounded (or killed) and persists each as a real
 * session expense via the canonical orchestrator, then re-syncs the notification
 * with the authoritative total. No-op on the web or when nothing was queued.
 */
export async function reconcileOutingQuickAdds(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const items = await drainOutingQuickAdds();
    if (items.length === 0) return;
    const ctx = await getActiveSessionContext();
    if (!ctx) return;
    for (const item of items) {
      if (item.amountCents > 0) {
        await quickAddSessionExpense({
          session: ctx.session,
          amountCents: item.amountCents,
          // Background taps follow the session's own phase (no boundary UI here).
          phaseId: ctx.session.phaseId,
          currency: ctx.currency,
          profileCategory: ctx.profileCategory,
        });
      }
    }
    window.dispatchEvent(new CustomEvent(OUTING_CHANGED_EVENT));
    await syncActiveOutingNotification();
  } catch {
    // reconciliation must never break the app flow.
  }
}

let bridgeRegistered = false;

/**
 * Listens for SW broadcasts (data changed by a notification action) and
 * re-syncs state when the tab returns to the foreground — Android freezes
 * background tabs, so messages sent meanwhile may only land now. On the native
 * app it also drains the notification's quick-add queue on every resume.
 */
export function registerOutingNotificationBridge(): void {
  if (bridgeRegistered) return;
  bridgeRegistered = true;

  // Native: reconcile any notification button taps on boot and on every resume
  // (the activity may stay resumed when the shade is pulled, so also on
  // visibility changes below). The drain is atomic, so double calls are safe.
  if (isNativeApp()) {
    void reconcileOutingQuickAdds();
    // FIELD item 10: reconcile the instant a notification button is tapped while
    // the app is open (the native event), so the active-outing screen reflects
    // the value immediately instead of only on the next resume.
    void addOutingQuickAddListener(() => {
      void reconcileOutingQuickAdds();
    });
    void import('@capacitor/app')
      .then(({ App }) => {
        void App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void reconcileOutingQuickAdds();
        });
      })
      .catch(() => {
        // App plugin unavailable — visibilitychange below still covers resume.
      });
  }

  if ('serviceWorker' in navigator) {
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
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (isNativeApp()) void reconcileOutingQuickAdds();
      window.dispatchEvent(new CustomEvent(OUTING_CHANGED_EVENT));
      syncActiveOutingNotification();
    }
  });
}
