import { describe, it, expect, vi, afterEach } from 'vitest';
import { logEvent, routeTemplate } from '../../../../worker/src/logger';

/**
 * DEC-441/442 (OBS-1, Â-NO-PII-LOGS) — the worker's structured log sink.
 * Two contracts guarded here:
 *   1. capability ids (share/img/mailbox/rooms) NEVER reach a log — paths are
 *      collapsed to route templates before logging;
 *   2. error messages are digit-scrubbed before emission.
 */
describe('routeTemplate', () => {
  it('collapses capability-bearing paths to templates', () => {
    expect(routeTemplate('/share/9f2c1c4e-77aa-4bfb-8a3e-52a1c1a2b3c4')).toBe('/share/:id');
    expect(routeTemplate('/share/9f2c1c4e/responses')).toBe('/share/:id/responses');
    expect(routeTemplate('/mailbox/actor-abc123')).toBe('/mailbox/:id');
    expect(routeTemplate('/img/550e8400-e29b-41d4-a716-446655440000')).toBe('/img/:id');
    expect(routeTemplate('/rooms/XKCD42/ws')).toBe('/rooms/:code/ws');
  });

  it('passes id-less routes through untouched', () => {
    expect(routeTemplate('/assistant')).toBe('/assistant');
    expect(routeTemplate('/health')).toBe('/health');
    expect(routeTemplate('/admin/overview')).toBe('/admin/overview');
    expect(routeTemplate('/share')).toBe('/share'); // create — no id yet
  });
});

describe('logEvent', () => {
  afterEach(() => vi.restoreAllMocks());

  function lastEntry(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
    const calls = spy.mock.calls;
    const line = calls[calls.length - 1]?.[0] as string;
    return JSON.parse(line) as Record<string, unknown>;
  }

  it('emits ONE parseable JSON line with the standard schema', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent('info', 'request', { requestId: 'rid-1', method: 'POST', route: '/assistant', status: 200, durationMs: 42 });
    expect(spy).toHaveBeenCalledTimes(1);
    const entry = lastEntry(spy);
    expect(entry).toMatchObject({
      level: 'info',
      service: 'worker',
      action: 'request',
      requestId: 'rid-1',
      method: 'POST',
      route: '/assistant',
      status: 200,
      durationMs: 42,
    });
    expect(typeof entry.ts).toBe('string');
  });

  it('drops debug below the production minimum level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent('debug', 'noisy_thing');
    expect(spy).not.toHaveBeenCalled();
  });

  it('scrubs 4+ digit runs out of error messages (Â-NO-PII-LOGS)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent('error', 'request_unhandled', { err: new Error('upstream 500 for card 4111111111111111') });
    const entry = lastEntry(spy);
    const err = entry.err as { name: string; message: string };
    expect(err.name).toBe('Error');
    expect(err.message).not.toContain('4111111111111111');
    expect(err.message).toContain('500'); // short runs (status codes) survive
  });

  it('folds non-Error throws into a NonError descriptor', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent('warn', 'weird_throw', { err: { odd: true } });
    const entry = lastEntry(spy);
    expect((entry.err as { name: string }).name).toBe('NonError');
  });
});
