import { APP_VERSION } from '@/utils/app-version';
import { scrubErrorMessage } from '@/domain/telemetry';
import { recordCrash } from '@/utils/crash-log';

/**
 * DEC-441 (2026-07-03 observability audit, OBS-1/OBS-2) — the app's single
 * structured logger. Replaces every scattered `console.*` so failures leave a
 * uniform, PII-safe trail:
 *
 *   - dev: pretty JSON on the console (all levels).
 *   - prod: console is SILENT; `error`/`fatal` land in the existing crash
 *     buffer (BUG-017) and ride the anonymous `/e` flush on next app open.
 *     `warn` is dev-only until a dedicated sink exists (deliberate — the crash
 *     buffer keeps 10 entries and drives `isCrashLooping`, so warns must not
 *     flood it: Â-CRASH-BUFFER-SANE).
 *
 * Masking (Â-NO-PII-LOGS): meta keys on the denylist are redacted wholesale;
 * every string value goes through `scrubErrorMessage` (4+ digit runs → `#`).
 * Kept dependency-light on purpose (no repositories, no i18n, no telemetry
 * platform probing) so any module can import it without cycles.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

/** Keys that must NEVER reach a log entry, whatever the caller passes. */
const REDACTED_KEYS = new Set([
  'text',
  'imagedataurl',
  'audiobase64',
  'blob',
  'key',
  'writetoken',
  'token',
  'authorization',
  'x-share-token',
  'pin',
  'password',
]);

export interface LogMeta {
  /** Feature/file emitting the log (e.g. 'share-orchestrator'). */
  module?: string;
  /** End-to-end correlation id (OBS-4) when the action crossed the worker. */
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  ts: string;
  level: LogLevel;
  service: 'app';
  action: string;
  appVersion: string;
  err?: { name: string; message: string; stack?: string };
  [key: string]: unknown;
}

function describeLogError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: scrubErrorMessage(err.message), stack: err.stack };
  }
  return { name: 'NonError', message: scrubErrorMessage(String(err)) };
}

/** System-generated identifiers that must survive masking verbatim — a UUID
 *  with a 4+ digit run would otherwise be corrupted and break correlation. */
const SCRUB_EXEMPT_KEYS = new Set(['requestid']);

function sanitizeMeta(meta: LogMeta | undefined): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey)) {
      out[key] = '[redacted]';
      continue;
    }
    if (typeof value === 'string' && !SCRUB_EXEMPT_KEYS.has(lowerKey)) {
      out[key] = scrubErrorMessage(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Pure core — builds the JSON entry (or null when below the minimum level).
 * Exported for tests; the `logger` facade wires it to the real sinks.
 */
export function buildLogEntry(input: {
  level: LogLevel;
  action: string;
  meta?: LogMeta;
  err?: unknown;
  minLevel: LogLevel;
  now?: Date;
}): LogEntry | null {
  if (LEVEL_ORDER[input.level] < LEVEL_ORDER[input.minLevel]) return null;
  return {
    ts: (input.now ?? new Date()).toISOString(),
    level: input.level,
    service: 'app',
    action: input.action,
    appVersion: APP_VERSION,
    ...sanitizeMeta(input.meta),
    ...(input.err !== undefined ? { err: describeLogError(input.err) } : {}),
  };
}

const MIN_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

function emit(level: LogLevel, action: string, meta?: LogMeta, err?: unknown): void {
  try {
    const entry = buildLogEntry({ level, action, meta, err, minLevel: MIN_LEVEL });
    if (!entry) return;

    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      const sink = level === 'debug' ? 'log' : level === 'fatal' ? 'error' : level;
      // eslint-disable-next-line no-console -- the ONE sanctioned console sink (dev only).
      console[sink](entry);
    }

    // error/fatal → crash buffer → anonymous `/e` flush on next open. The
    // buffer entry is the already-scrubbed action + error message, never meta.
    if (level === 'error' || level === 'fatal') {
      recordCrash({
        message: entry.err ? `${action}: ${entry.err.message}` : action,
        stack: entry.err?.stack,
      });
    }
  } catch {
    // Logging must never break the action being logged.
  }
}

export const logger = {
  debug: (action: string, meta?: LogMeta): void => emit('debug', action, meta),
  info: (action: string, meta?: LogMeta): void => emit('info', action, meta),
  warn: (action: string, meta?: LogMeta, err?: unknown): void => emit('warn', action, meta, err),
  error: (action: string, meta?: LogMeta, err?: unknown): void => emit('error', action, meta, err),
  fatal: (action: string, meta?: LogMeta, err?: unknown): void => emit('fatal', action, meta, err),
};
