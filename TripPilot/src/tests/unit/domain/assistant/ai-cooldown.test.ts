import { describe, it, expect } from 'vitest';
import {
  cooldownFromBody,
  defaultCooldown,
  cooldownRemainingSec,
  isCoolingDown,
  type AiCooldown,
} from '@/domain/assistant/ai-cooldown';

const NOW = 1_000_000;

describe('cooldownFromBody (FB-26)', () => {
  it('builds a minute-scope cooldown from a structured worker 429', () => {
    const c = cooldownFromBody({ aiUnavailable: true, retryAfterSec: 12, scope: 'minute' }, NOW);
    expect(c).toEqual({ until: NOW + 12_000, scope: 'minute' });
  });

  it('builds a day-scope cooldown that comes back later', () => {
    const c = cooldownFromBody({ aiUnavailable: true, retryAfterSec: 3600, scope: 'day' }, NOW);
    expect(c?.scope).toBe('day');
    expect(c?.until).toBe(NOW + 3600 * 1000);
  });

  it('infers day scope when no scope is sent but the wait is long (> 5 min)', () => {
    const c = cooldownFromBody({ aiUnavailable: true, retryAfterSec: 600 }, NOW);
    expect(c?.scope).toBe('day');
  });

  it('infers minute scope for a short wait without an explicit scope', () => {
    const c = cooldownFromBody({ aiUnavailable: true, retryAfterSec: 8 }, NOW);
    expect(c?.scope).toBe('minute');
  });

  it('recognizes the legacy *_rate_limited error shape', () => {
    const c = cooldownFromBody({ error: 'assistant_rate_limited' }, NOW);
    expect(c).not.toBeNull();
    expect(c?.scope).toBe('minute');
    // No number sent → honest 30s default.
    expect(c?.until).toBe(NOW + 30_000);
  });

  it('falls back to 30s when the number is missing/garbage', () => {
    expect(cooldownFromBody({ aiUnavailable: true, retryAfterSec: 'soon' }, NOW)?.until).toBe(NOW + 30_000);
    expect(cooldownFromBody({ aiUnavailable: true, retryAfterSec: -5 }, NOW)?.until).toBe(NOW + 30_000);
    expect(cooldownFromBody({ aiUnavailable: true, retryAfterSec: 0 }, NOW)?.until).toBe(NOW + 30_000);
  });

  it('caps an absurd wait at a day and rounds fractional seconds up', () => {
    expect(cooldownFromBody({ aiUnavailable: true, retryAfterSec: 999_999 }, NOW)?.until).toBe(NOW + 86_400 * 1000);
    expect(cooldownFromBody({ aiUnavailable: true, retryAfterSec: 7.2, scope: 'minute' }, NOW)?.until).toBe(NOW + 8_000);
  });

  it('holds a contradictory day-scope-with-tiny-number to at least a minute', () => {
    const c = cooldownFromBody({ aiUnavailable: true, retryAfterSec: 3, scope: 'day' }, NOW);
    expect(c).toEqual({ until: NOW + 60_000, scope: 'day' });
  });

  it('returns null for a body that is not a rate-limit signal', () => {
    expect(cooldownFromBody({ error: 'bad_text' }, NOW)).toBeNull();
    expect(cooldownFromBody({ ok: true }, NOW)).toBeNull();
    expect(cooldownFromBody(null, NOW)).toBeNull();
    expect(cooldownFromBody('nope', NOW)).toBeNull();
  });
});

describe('defaultCooldown / remaining / isCoolingDown', () => {
  it('defaultCooldown is a ~30s minute cooldown', () => {
    expect(defaultCooldown(NOW)).toEqual({ until: NOW + 30_000, scope: 'minute' });
  });

  it('cooldownRemainingSec rounds up and clamps at 0', () => {
    const c: AiCooldown = { until: NOW + 4_200, scope: 'minute' };
    expect(cooldownRemainingSec(c, NOW)).toBe(5);
    expect(cooldownRemainingSec(c, NOW + 4_200)).toBe(0);
    expect(cooldownRemainingSec(c, NOW + 10_000)).toBe(0);
    expect(cooldownRemainingSec(null, NOW)).toBe(0);
  });

  it('isCoolingDown reflects whether time remains', () => {
    const c: AiCooldown = { until: NOW + 1_000, scope: 'minute' };
    expect(isCoolingDown(c, NOW)).toBe(true);
    expect(isCoolingDown(c, NOW + 1_000)).toBe(false);
    expect(isCoolingDown(null, NOW)).toBe(false);
  });
});
