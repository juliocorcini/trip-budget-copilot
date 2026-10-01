import { appSettingsRepository } from '@/data/repositories';
import { itineraryLegRepository } from '@/data/repositories/itinerary-leg-repository';
import { getSchedulableTransports, type SchedulableTransport } from '@/domain/itinerary/itinerary-domain';
import { isNativeApp } from '@/utils/native/platform';
import { logger } from '@/utils/logger';
import { showInAppNotification } from '@/components/InAppNotificationOverlay';
import i18n from '@/i18n';

const DEFAULT_LEAD_MINUTES = 60;
const TRANSPORT_ICON: Record<string, string> = {
  flight: 'flight_takeoff',
  train: 'train',
  bus: 'directions_bus',
  car: 'directions_car',
  ferry: 'directions_boat',
  walk: 'directions_walk',
  other: 'commute',
};

let booted = false;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimers(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

async function fireNotification(transport: SchedulableTransport, leadMinutes: number): Promise<void> {
  const icon = TRANSPORT_ICON[transport.transportType] ?? 'commute';
  const title = i18n.t('itinerary.transport_reminder_title');
  const body = i18n.t('itinerary.transport_reminder_body', {
    destination: transport.destination,
    time: transport.time,
    minutes: leadMinutes,
  });

  if (document.visibilityState === 'visible') {
    showInAppNotification({
      id: `${transport.legId}:${transport.departureIso}`,
      icon,
      title,
      body,
    });
  }

  if (isNativeApp()) {
    try {
      const { showLocalNotification } = await import('@/utils/native/notifications');
      await showLocalNotification(title, body, '/itinerary');
    } catch {
      logger.warn('transport_reminder_native_failed', { module: 'transport-reminder-boot' });
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const { scheduleLocalNotification } = await import('@/utils/notifications');
      scheduleLocalNotification({ title, body });
    } catch {
      logger.warn('transport_reminder_web_failed', { module: 'transport-reminder-boot' });
    }
  }
}

async function scheduleReminders(): Promise<void> {
  clearTimers();

  const settings = await appSettingsRepository.get().catch(() => null);
  if (!settings?.transportReminderEnabled) return;

  const tripId = settings.activeTrip;
  if (!tripId) return;

  const leadMinutes = settings.transportReminderMinutes ?? DEFAULT_LEAD_MINUTES;
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 16);

  const legs = await itineraryLegRepository.getByTripId(tripId);
  const transports = getSchedulableTransports(legs, nowIso);

  for (const transport of transports) {
    const departureMs = new Date(transport.departureIso).getTime();
    const fireMs = departureMs - leadMinutes * 60_000;
    const delayMs = fireMs - now.getTime();

    if (delayMs < 0) continue;
    // Only schedule within a 24h window (beyond that, foreground re-sync will catch it)
    if (delayMs > 24 * 60 * 60_000) continue;

    const key = `${transport.legId}:${transport.departureIso}`;
    if (timers.has(key)) continue;

    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void fireNotification(transport, leadMinutes);
      }, delayMs),
    );
  }
}

export function registerTransportReminders(): void {
  if (booted) return;
  booted = true;
  window.setTimeout(() => void scheduleReminders(), 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void scheduleReminders();
  });
}

export function teardownTransportReminders(): void {
  clearTimers();
  booted = false;
}
