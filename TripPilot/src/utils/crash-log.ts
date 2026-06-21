import { safeLocalStorage } from '@/utils/safe-storage';
import { bumpTelemetryCounter } from '@/utils/telemetry-events';

/**
 * BUG-017: crash telemetry + loop detection. iOS standalone PWAs send nothing
 * to a console anyone can read, so a deterministic crash (e.g. an invalid
 * currency before BUG-010) just looped: reload → same crash → "it restarts by
 * itself". This keeps a small rotating buffer of the last crashes so the
 * ErrorBoundary can detect the loop and offer recovery instead of reloading
 * into the same wall.
 */
const CRASH_LOG_KEY = 'trippilot.crash-log';
const MAX_ENTRIES = 10;
const LOOP_WINDOW_MS = 60_000;
const LOOP_THRESHOLD = 3;

export interface CrashEntry {
  timestamp: number;
  message: string;
  stack?: string;
  componentStack?: string;
}

export function readCrashLog(): CrashEntry[] {
  const raw = safeLocalStorage.get(CRASH_LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CrashEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordCrash(entry: Omit<CrashEntry, 'timestamp'>): void {
  const next = [...readCrashLog(), { ...entry, timestamp: Date.now() }].slice(-MAX_ENTRIES);
  safeLocalStorage.set(CRASH_LOG_KEY, JSON.stringify(next));
  // DEC-248: count crashes for the admin dashboard (a cumulative tally — the
  // rotating buffer above only keeps the last few). Non-monetary, best-effort.
  bumpTelemetryCounter('crashes');
}

/** True when more than LOOP_THRESHOLD crashes happened in the last minute. */
export function isCrashLooping(now: number = Date.now()): boolean {
  const recent = readCrashLog().filter((e) => now - e.timestamp <= LOOP_WINDOW_MS);
  return recent.length > LOOP_THRESHOLD;
}

export function clearCrashLog(): void {
  safeLocalStorage.remove(CRASH_LOG_KEY);
}

/** Normalizes anything thrown into a { message, stack } pair for the buffer. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}
