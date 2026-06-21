import { safeLocalStorage } from '@/utils/safe-storage';

/**
 * DEC-248 — tiny, dependency-light event tally for telemetry. Kept separate from
 * `utils/telemetry.ts` (which pulls the whole repository graph) so the bump call
 * sites — the crash logger, the AI dispatch, the receipt scanner — stay cheap to
 * import and free of cycles. Stores ONLY non-monetary action counts in
 * localStorage; they ride along on the next daily heartbeat.
 */

const EVENT_COUNTERS_KEY = 'trippilot.telemetry.events';

export type TelemetryEvent = 'aiEntries' | 'receiptScans' | 'crashes';

export function readTelemetryEvents(): Record<TelemetryEvent, number> {
  const empty: Record<TelemetryEvent, number> = { aiEntries: 0, receiptScans: 0, crashes: 0 };
  const raw = safeLocalStorage.get(EVENT_COUNTERS_KEY);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<TelemetryEvent, number>>;
    return {
      aiEntries: Number(parsed.aiEntries) || 0,
      receiptScans: Number(parsed.receiptScans) || 0,
      crashes: Number(parsed.crashes) || 0,
    };
  } catch {
    return empty;
  }
}

/** Increment a local, NON-MONETARY action tally. Best-effort + never throws —
 *  telemetry can never break the real action it is counting. */
export function bumpTelemetryCounter(key: TelemetryEvent, by = 1): void {
  try {
    const current = readTelemetryEvents();
    current[key] = (current[key] ?? 0) + by;
    safeLocalStorage.set(EVENT_COUNTERS_KEY, JSON.stringify(current));
  } catch {
    /* ignore — telemetry is best-effort */
  }
}
