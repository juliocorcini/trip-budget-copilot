import { Capacitor } from '@capacitor/core';
import {
  appSettingsRepository,
  participantRepository,
  peerLinkRepository,
  plannedPurchaseRepository,
  sessionRepository,
  settlementRepository,
  splitRepository,
  transactionRepository,
  tripRepository,
  walletRepository,
} from '@/data/repositories';
import {
  buildTelemetryPayload,
  deriveTelemetryFlags,
  shouldSendHeartbeat,
  utcDayKey,
  type TelemetryCounts,
} from '@/domain/telemetry';
import { getSyncWorkerUrl } from '@/data/sync/config';
import { APP_VERSION } from '@/utils/app-version';
import { getInstallationId } from '@/utils/entity-factory';
import { isNativeApp } from '@/utils/native/platform';
import { webPlatformTag, deviceBrowserFamily } from '@/utils/platform';
import { safeLocalStorage } from '@/utils/safe-storage';
import { readTelemetryEvents } from '@/utils/telemetry-events';

/**
 * DEC-248 — telemetry boundary (the ONLY impure part). Gathers non-monetary
 * usage counts from the repositories, resolves the owner's display name, builds
 * the payload via the pure domain module and POSTs a heartbeat to the Worker
 * `/t` — at most once per UTC day, on app open, best-effort and fully silent on
 * any failure/offline. Honors the `telemetryEnabled` opt-out and skips the demo
 * sandbox. Telemetry must NEVER break a real action, so everything is wrapped.
 */

const LAST_SENT_KEY = 'trippilot.telemetry.last-sent-day';

async function gatherCounts(): Promise<TelemetryCounts> {
  const [
    trips,
    transactions,
    outings,
    splits,
    settlements,
    plannedPurchases,
    wallets,
    participants,
    connections,
  ] = await Promise.all([
    tripRepository.count(),
    transactionRepository.getAll(),
    sessionRepository.count(),
    splitRepository.count(),
    settlementRepository.count(),
    plannedPurchaseRepository.count(),
    walletRepository.count(),
    participantRepository.count(),
    peerLinkRepository.count(),
  ]);
  const events = readTelemetryEvents();
  return {
    trips,
    expenses: transactions.filter((t) => t.type === 'expense').length,
    outings,
    splits,
    settlements,
    plannedPurchases,
    wallets,
    participants,
    connections,
    aiEntries: events.aiEntries,
    receiptScans: events.receiptScans,
    crashes: events.crashes,
  };
}

async function resolveOwnerName(): Promise<string | null> {
  try {
    const participants = await participantRepository.getAll();
    const owner = participants.find((p) => p.isOwner);
    if (owner && owner.name.trim() !== '') return owner.name;
  } catch {
    /* fall through to the device name */
  }
  return null;
}

/**
 * DEC-253: report the REAL OS. `Capacitor.getPlatform()` is `'web'` for any
 * non-native shell — including the iPhone PWA — so an iOS user looked like
 * "WEB". Native shells keep their honest `ios`/`android`; the web build is
 * classified from the UA (`ios-web` / `android-web` / `web`).
 */
export function telemetryPlatform(): string {
  try {
    if (Capacitor.isNativePlatform()) return Capacitor.getPlatform();
  } catch {
    /* fall through to UA-based detection */
  }
  return webPlatformTag();
}

/** Send a usage heartbeat at most once per UTC day, on app open. Non-blocking,
 *  silent on any failure. Respects the opt-out and never reports the demo. */
export async function sendHeartbeatIfDue(nowMs: number = Date.now()): Promise<void> {
  try {
    const settings = await appSettingsRepository.get();
    if (settings.telemetryEnabled === false) return;
    if (settings.isDemo) return;
    // Only report genuinely set-up installs. A never-onboarded drive-by load (a
    // bot, a crawler, a guest opening a shared link) has a transient default
    // settings row — reporting it would flood the dashboard with empty "Meu
    // dispositivo / all zeros" rows that are not real users.
    if (!settings.onboardingCompleted) return;

    const today = utcDayKey(nowMs);
    const lastSent = safeLocalStorage.get(LAST_SENT_KEY);
    if (!shouldSendHeartbeat(lastSent, today)) return;

    const counts = await gatherCounts();
    const ownerName = (await resolveOwnerName()) ?? settings.deviceName ?? null;
    const flags = deriveTelemetryFlags({
      aiQuickEntryEnabled: settings.aiQuickEntryEnabled,
      cloudReceiptOcrEnabled: settings.cloudReceiptOcrEnabled,
      locationCaptureEnabled: settings.locationCaptureEnabled,
      appLockEnabled: settings.appLockEnabled,
      isNative: isNativeApp(),
      splits: counts.splits,
      wallets: counts.wallets,
    });
    const payload = buildTelemetryPayload({
      installId: getInstallationId(),
      nowMs,
      displayName: ownerName,
      appVersion: APP_VERSION,
      platform: telemetryPlatform(),
      browser: deviceBrowserFamily(),
      locale: typeof navigator !== 'undefined' ? navigator.language || 'unknown' : 'unknown',
      counts,
      flags,
    });

    const res = await fetch(`${getSyncWorkerUrl()}/t`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (res.ok) {
      safeLocalStorage.set(LAST_SENT_KEY, today);
    }
  } catch {
    /* swallow — telemetry must never surface to the user */
  }
}
