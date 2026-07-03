/**
 * DEC-441 (2026-07-03 observability audit, OBS-1) — structured JSON logging for
 * the worker. `wrangler.jsonc` already has `observability.enabled: true`, so
 * every `console.log` line lands in Cloudflare Workers Logs; emitting ONE JSON
 * object per event makes those logs queryable by field (level, action, route,
 * status, requestId) instead of being opaque strings.
 *
 * Hard rules (Â-NO-PII-LOGS):
 *   - never log bodies: no request/response payloads, no `text`, no images.
 *   - capability ids never reach a log — callers pass ROUTE TEMPLATES
 *     (`/share/:id`), produced by `routeTemplate()` below.
 *   - error messages are digit-scrubbed (4+ digit runs → `#`), mirroring the
 *     existing client/server telemetry scrub.
 */

export type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<WorkerLogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Workers Logs is the investigation surface — keep info+ in production. */
const MIN_LEVEL: WorkerLogLevel = 'info';

export interface WorkerLogContext {
  requestId?: string;
  installId?: string;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  err?: unknown;
  [key: string]: unknown;
}

/** Same masking rule as `scrubErrorMessageServer`: long digit runs become `#`. */
function scrubLogText(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/\d{4,}/g, '#').trim().slice(0, 240);
}

function describeLogError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) return { name: err.name, message: scrubLogText(err.message) };
  return { name: 'NonError', message: scrubLogText(String(err)) };
}

/**
 * Replace capability/actor ids in a pathname with `:id` so logs aggregate per
 * route and never persist an unguessable id (the id IS the read capability for
 * shares/images). `/admin/*` sub-paths carry no ids and pass through.
 */
export function routeTemplate(pathname: string): string {
  return pathname
    .replace(/^\/share\/[^/]+/, '/share/:id')
    .replace(/^\/mailbox\/[^/]+/, '/mailbox/:id')
    .replace(/^\/img\/[^/]+/, '/img/:id')
    .replace(/^\/rooms\/[^/]+/, '/rooms/:code');
}

/** Emit one structured log event (captured by Workers Logs). */
export function logEvent(level: WorkerLogLevel, action: string, ctx: WorkerLogContext = {}): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const { err, ...rest } = ctx;
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'worker',
    action,
    ...rest,
    ...(err !== undefined ? { err: describeLogError(err) } : {}),
  };
  // eslint-disable-next-line no-console -- the ONE sanctioned console sink (Workers Logs).
  console.log(JSON.stringify(entry));
}
