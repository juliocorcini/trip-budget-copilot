import { appSettingsRepository } from '@/data/repositories';
import { getSyncWorkerUrl } from '@/data/sync/config';
import { selectErrorReports } from '@/domain/telemetry';
import { APP_VERSION } from '@/utils/app-version';
import { readCrashLog } from '@/utils/crash-log';
import { getInstallationId } from '@/utils/entity-factory';
import { safeLocalStorage } from '@/utils/safe-storage';
import { telemetryPlatform } from '@/utils/telemetry';

/**
 * DEC-251 (Onda B) — anonymous error flush (the ONLY impure part). Drains the
 * local crash buffer (BUG-017) to the Worker `/e` route on app open: at most
 * one report per crash (a persisted high-water mark dedups across reloads),
 * scrubbed both client- and server-side, best-effort and fully silent on any
 * failure. Honors the `telemetryEnabled` opt-out and skips the demo sandbox.
 * Error reporting must NEVER break a real action, so everything is wrapped.
 */

const LAST_FLUSHED_KEY = 'trippilot.error-report.last-flushed-at';
const MAX_REPORTS_PER_FLUSH = 10;

function readLastFlushedAt(): number {
  const raw = safeLocalStorage.get(LAST_FLUSHED_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function flushPendingErrorReports(): Promise<void> {
  try {
    const settings = await appSettingsRepository.get();
    if (settings.telemetryEnabled === false) return;
    if (settings.isDemo) return;

    const { messages, lastFlushedAt } = selectErrorReports(readCrashLog(), readLastFlushedAt());
    if (messages.length === 0) return;

    const installId = getInstallationId();
    const appVersion = APP_VERSION;
    const platform = telemetryPlatform();
    const batch = messages.slice(-MAX_REPORTS_PER_FLUSH);

    let allDelivered = true;
    for (const message of batch) {
      try {
        const res = await fetch(`${getSyncWorkerUrl()}/e`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ installId, message, appVersion, platform }),
          keepalive: true,
        });
        if (!res.ok) allDelivered = false;
      } catch {
        allDelivered = false;
      }
    }

    // Advance the high-water mark only when every report landed; otherwise the
    // unsent ones are retried on the next open (at-least-once — the server
    // dedups by message hash, so a retry only nudges the occurrence count).
    if (allDelivered) safeLocalStorage.set(LAST_FLUSHED_KEY, String(lastFlushedAt));
  } catch {
    /* swallow — error reporting must never surface to the user */
  }
}
