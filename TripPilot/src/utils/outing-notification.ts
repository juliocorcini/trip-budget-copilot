import i18n from '@/i18n';
import { db } from '@/data/db/database';
import {
  buildOutingNotificationPayload,
  calculateSessionTotal,
  pickFollowupSubcategoryIds,
  OUTING_NOTIFICATION_TAG,
  OUTING_FOLLOWUP_TAG,
} from '@/domain/outing';
import { quickAddSessionExpense, assignTransactionSubcategory } from '@/domain/orchestrators';
import { formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import { getInstallationId } from '@/utils/entity-factory';
import type { Session } from '@/domain/types/session';
import type { OutingNotificationStrings } from '@/domain/outing';

/**
 * DEC-120 (R-11): active-outing notification bridge (PWA best effort).
 *
 * The app builds the full payload (i18n labels, amounts, follow-up
 * subcategories) and shows it through the SW registration. Action clicks
 * land on the SW; when a window client exists the SW delegates back here
 * (full domain flow), otherwise it falls back to a direct IndexedDB write.
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

export function wasOutingNotificationPrompted(): boolean {
  return localStorage.getItem(PROMPTED_KEY) !== null;
}

export function markOutingNotificationPrompted(): void {
  localStorage.setItem(PROMPTED_KEY, '1');
}

export async function requestOutingNotificationPermission(): Promise<NotificationPermission> {
  markOutingNotificationPrompted();
  return Notification.requestPermission();
}

function canNotify(): boolean {
  return isOutingNotificationSupported() && Notification.permission === 'granted';
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

function buildStrings(sessionName: string, totalCents: number, currency: string): OutingNotificationStrings {
  const locale = getActiveIntlLocale();
  return {
    title: i18n.t('outing.notification_title', { name: sessionName }),
    body: i18n.t('outing.notification_body', { total: formatMoney(totalCents, currency, locale) }),
    bodyTemplate: i18n.t('outing.notification_body', { total: '{{total}}' }),
    openAction: i18n.t('outing.notification_open'),
    followupTitle: i18n.t('outing.notification_followup_title'),
    // The SW interpolates {{amount}} when it registers the expense itself.
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
  if (!canNotify()) return;
  const registration = await getReadyRegistration();
  if (!registration) return;

  const locale = getActiveIntlLocale();
  const payload = buildOutingNotificationPayload({
    session: input.session,
    totalCents: input.totalCents,
    currency: input.currency,
    profileCategory: input.profileCategory,
    strings: buildStrings(input.session.name, input.totalCents, input.currency),
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

interface FollowupInput {
  txId: string;
  amountCents: number;
  currency: string;
  profileCategory: string | null;
}

/** Second notification: "what was that expense?" with likely subcategories. */
async function showFollowupNotification(input: FollowupInput): Promise<void> {
  if (!canNotify()) return;
  const registration = await getReadyRegistration();
  if (!registration) return;

  const locale = getActiveIntlLocale();
  const subActions = pickFollowupSubcategoryIds(input.profileCategory, input.amountCents).map(
    (id) => ({ action: `sub_${id}`, title: i18n.t(`taxonomy.${id}` as never) as string }),
  );
  const options: SwNotificationOptions = {
    tag: OUTING_FOLLOWUP_TAG,
    body: i18n.t('outing.notification_followup_body', {
      amount: formatMoney(input.amountCents, input.currency, locale),
    }),
    icon: '/icons/icon-192.png',
    renotify: false,
    actions: [...subActions, { action: 'open', title: i18n.t('outing.notification_open') }],
    data: { kind: 'followup', txId: input.txId },
  };
  await registration.showNotification(
    i18n.t('outing.notification_followup_title'),
    options as NotificationOptions,
  );
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

async function handleQuickAddMessage(amountCents: number): Promise<void> {
  const ctx = await getActiveSessionContext();
  if (!ctx) return;
  const tx = await quickAddSessionExpense({
    session: ctx.session,
    amountCents,
    phaseId: ctx.session.phaseId,
    currency: ctx.currency,
    profileCategory: ctx.profileCategory,
  });
  const sessionTxs = await db.transactions.where('sessionId').equals(ctx.session.id).toArray();
  await syncOutingNotification({
    session: ctx.session,
    totalCents: calculateSessionTotal(sessionTxs),
    currency: ctx.currency,
    profileCategory: ctx.profileCategory,
  });
  await showFollowupNotification({
    txId: tx.id,
    amountCents,
    currency: ctx.currency,
    profileCategory: ctx.profileCategory,
  });
  window.dispatchEvent(new CustomEvent(OUTING_CHANGED_EVENT));
}

async function handleSetSubcategoryMessage(txId: string, subcategoryId: string): Promise<void> {
  await assignTransactionSubcategory(txId, subcategoryId);
  window.dispatchEvent(new CustomEvent(OUTING_CHANGED_EVENT));
}

let bridgeRegistered = false;

/** Listens for SW-delegated notification actions (app window open). */
export function registerOutingNotificationBridge(): void {
  if (bridgeRegistered || !('serviceWorker' in navigator)) return;
  bridgeRegistered = true;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'OUTING_NOTIFICATION_QUICK_ADD' && typeof data.amountCents === 'number') {
      handleQuickAddMessage(data.amountCents);
    } else if (
      data.type === 'OUTING_NOTIFICATION_SET_SUBCATEGORY' &&
      typeof data.txId === 'string' &&
      typeof data.subcategoryId === 'string'
    ) {
      handleSetSubcategoryMessage(data.txId, data.subcategoryId);
    } else if (
      data.type === 'OUTING_NOTIFICATION_NAVIGATE' &&
      typeof data.url === 'string' &&
      window.location.pathname !== data.url
    ) {
      window.location.assign(data.url);
    }
  });
}
