/**
 * FB-26 (DEC-276) — graceful AI degradation. When the Groq free tier is
 * exhausted the worker answers a structured 429 body
 * `{ aiUnavailable: true, retryAfterSec, scope }` (derived from `retry-after` /
 * `x-ratelimit-reset-*`). This PURE module turns that into a client-side
 * cooldown: it disables the AI triggers and powers an honest countdown, never a
 * fake one. The model is untrusted, so every field is coerced.
 */
export type AiCooldownScope = 'minute' | 'day';

export interface AiCooldown {
  /** Epoch ms after which the AI may be retried. */
  until: number;
  /** 'minute' → resets in seconds (TPM/RPM); 'day' → comes back later (RPD). */
  scope: AiCooldownScope;
}

/** Hard cap so a garbage/huge `retryAfterSec` can't lock the UI forever. */
const MAX_COOLDOWN_SEC = 86_400;
/** Honest fallback when the worker signalled a 429 but sent no usable number. */
const DEFAULT_COOLDOWN_SEC = 30;
/** Above this, a reset is treated as "comes back later" rather than a countdown. */
const DAY_THRESHOLD_SEC = 300;

function coerceSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(Math.ceil(value), MAX_COOLDOWN_SEC);
}

/**
 * Builds a cooldown from a worker 429 body. Returns null when the body is not a
 * rate-limit signal (so a caller can keep its own default for a bare 429).
 */
export function cooldownFromBody(body: unknown, now: number): AiCooldown | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const isRateLimit =
    b.aiUnavailable === true ||
    (typeof b.error === 'string' && b.error.endsWith('_rate_limited'));
  if (!isRateLimit) return null;

  const seconds = coerceSeconds(b.retryAfterSec) ?? DEFAULT_COOLDOWN_SEC;
  const explicitScope: AiCooldownScope | null =
    b.scope === 'day' || b.scope === 'minute' ? b.scope : null;
  const scope: AiCooldownScope = explicitScope ?? (seconds > DAY_THRESHOLD_SEC ? 'day' : 'minute');
  // A 'day' scope with a tiny number is contradictory — hold at least a minute
  // so we never show "comes back later · 3s".
  const effective = scope === 'day' ? Math.max(seconds, 60) : seconds;
  return { until: now + effective * 1000, scope };
}

/** A bare cooldown for a 429 whose body we couldn't read (still honest: ~30s). */
export function defaultCooldown(now: number): AiCooldown {
  return { until: now + DEFAULT_COOLDOWN_SEC * 1000, scope: 'minute' };
}

/** Whole seconds left (rounded up), clamped at 0. */
export function cooldownRemainingSec(cooldown: AiCooldown | null, now: number): number {
  if (!cooldown) return 0;
  return Math.max(0, Math.ceil((cooldown.until - now) / 1000));
}

export function isCoolingDown(cooldown: AiCooldown | null, now: number): boolean {
  return cooldownRemainingSec(cooldown, now) > 0;
}
