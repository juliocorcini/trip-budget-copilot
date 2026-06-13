import i18n from '@/i18n';
import { localDateString } from '@/domain/dates';
import { CHECK_IN_INTENT_CATALOG, shouldPromptCheckIn } from '@/domain/check-in';
import { appSettingsRepository } from '@/data/repositories/app-settings-repository';
import { safeLocalStorage } from '@/utils/safe-storage';
import { notifyAppDataChanged } from '@/hooks/useAppData';

/**
 * M8 (E5): daily check-in notification — best-effort PWA reminder.
 *
 * The notification asks "how will the day go?" with the three intents as
 * Notification Actions where supported; tapping an action lets the SW write
 * the intent straight to the DB (see sw.js) without opening the app. Where
 * actions are unavailable, tapping the body just opens the dashboard on the
 * check-in card (ÂNCORA 19 — degrade cleanly).
 *
 * True background scheduling is NOT possible without push/Notification
 * Triggers (no backend — local-first), so firing is best-effort: it happens
 * on app boot inside a morning window, at most once per day.
 */

/** Must match CHECKIN_TAG in public/sw.js. */
const CHECKIN_TAG = 'trippilot-daily-checkin';
const PROMPTED_DATE_KEY = 'trippilot-checkin-prompt-date';

/** Only nudge in the morning — a check-in for the day ahead, not the past. */
const MORNING_START_HOUR = 5;
const MORNING_END_HOUR = 13;

export function isCheckInNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'Notification' in window;
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

function buildActions(): { action: string; title: string }[] {
  return CHECK_IN_INTENT_CATALOG.map((option) => ({
    action: option.intent,
    title: i18n.t(option.labelKey as never),
  }));
}

/** Shows the answerable check-in notification (no-op if already set today). */
export async function showCheckInPrompt(): Promise<void> {
  try {
    if (!isCheckInNotificationSupported() || Notification.permission !== 'granted') return;
    const todayDate = localDateString(new Date());
    const settings = await appSettingsRepository.get();
    if (!shouldPromptCheckIn(settings.dailyCheckIn, todayDate)) return;

    const registration = await getReadyRegistration();
    if (!registration) return;

    await registration.showNotification(i18n.t('dashboard.checkin_notification_title'), {
      tag: CHECKIN_TAG,
      body: i18n.t('dashboard.checkin_notification_body'),
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      renotify: false,
      // Actions are ignored where unsupported — the body tap still opens the app.
      actions: buildActions(),
      data: { kind: 'checkin', date: todayDate },
    } as NotificationOptions);
  } catch {
    // A reminder must never break the boot flow.
  }
}

/**
 * Best-effort trigger: fire once per day, in the morning window, only when
 * the day has no check-in yet and notifications are permitted.
 */
export async function maybeShowCheckInPrompt(): Promise<void> {
  if (!isCheckInNotificationSupported() || Notification.permission !== 'granted') return;
  const hour = new Date().getHours();
  if (hour < MORNING_START_HOUR || hour >= MORNING_END_HOUR) return;

  const todayDate = localDateString(new Date());
  if (safeLocalStorage.get(PROMPTED_DATE_KEY) === todayDate) return;
  safeLocalStorage.set(PROMPTED_DATE_KEY, todayDate);
  await showCheckInPrompt();
}

let bridgeRegistered = false;

/**
 * Bridges SW broadcasts: when a check-in action wrote the intent to the DB,
 * refresh every mounted useAppData (mirrors the outing bridge).
 */
export function registerCheckInNotificationBridge(): void {
  if (bridgeRegistered || !('serviceWorker' in navigator)) return;
  bridgeRegistered = true;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (data && typeof data === 'object' && data.type === 'APP_DATA_CHANGED') {
      notifyAppDataChanged();
    }
  });
}
