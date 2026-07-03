import { describe, it, expect } from 'vitest';
import { buildLogEntry, type LogLevel } from '@/utils/logger';
import { APP_VERSION } from '@/utils/app-version';

/**
 * DEC-441 (OBS-1/OBS-2) — the structured app logger's pure core. The entry
 * shape and, above all, the masking rules (Â-NO-PII-LOGS) are contracts:
 * a regression here means tokens/PII start leaking into logs.
 */
describe('buildLogEntry', () => {
  const base = { level: 'warn' as LogLevel, action: 'test_action', minLevel: 'debug' as LogLevel };

  it('builds the standard schema: ts/level/service/action/appVersion', () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    const entry = buildLogEntry({ ...base, now });
    expect(entry).toMatchObject({
      ts: '2026-07-03T12:00:00.000Z',
      level: 'warn',
      service: 'app',
      action: 'test_action',
      appVersion: APP_VERSION,
    });
  });

  it('drops entries below the minimum level and keeps entries at/above it', () => {
    expect(buildLogEntry({ level: 'debug', action: 'a', minLevel: 'warn' })).toBeNull();
    expect(buildLogEntry({ level: 'info', action: 'a', minLevel: 'warn' })).toBeNull();
    expect(buildLogEntry({ level: 'warn', action: 'a', minLevel: 'warn' })).not.toBeNull();
    expect(buildLogEntry({ level: 'fatal', action: 'a', minLevel: 'warn' })).not.toBeNull();
  });

  it('redacts every denylisted meta key wholesale (Â-NO-PII-LOGS)', () => {
    const entry = buildLogEntry({
      ...base,
      meta: {
        text: 'paguei 50 euros pro Jack',
        imageDataUrl: 'data:image/jpeg;base64,AAAA',
        token: 'secret-token',
        writeToken: 'wt-1',
        authorization: 'Bearer abc',
        pin: '1234',
        password: 'hunter2',
        key: 'aes-key',
      },
    })!;
    for (const field of ['text', 'imageDataUrl', 'token', 'writeToken', 'authorization', 'pin', 'password', 'key']) {
      expect(entry[field], field).toBe('[redacted]');
    }
  });

  it('redacts denylisted keys case-insensitively', () => {
    const entry = buildLogEntry({ ...base, meta: { Token: 'abc', TEXT: 'hello' } })!;
    expect(entry.Token).toBe('[redacted]');
    expect(entry.TEXT).toBe('[redacted]');
  });

  it('masks digit runs (4+) inside every string meta value', () => {
    const entry = buildLogEntry({ ...base, meta: { detail: 'card 4111111111111111 declined', status: 429 } })!;
    expect(entry.detail).not.toContain('4111111111111111');
    expect(String(entry.detail)).toContain('declined');
    expect(entry.status).toBe(429); // numbers pass through — they are status codes/counters
  });

  it('folds an Error into {name, message, stack} with the message scrubbed', () => {
    const err = new Error('failed for +5511999998888');
    const entry = buildLogEntry({ ...base, err })!;
    expect(entry.err?.name).toBe('Error');
    expect(entry.err?.message).not.toContain('5511999998888');
    expect(entry.err?.stack).toBeDefined();
  });

  it('folds a non-Error throw into a NonError descriptor', () => {
    const entry = buildLogEntry({ ...base, err: 'plain string failure' })!;
    expect(entry.err).toMatchObject({ name: 'NonError', message: 'plain string failure' });
  });

  it('keeps requestId/module context fields intact for correlation (OBS-4)', () => {
    const entry = buildLogEntry({
      ...base,
      meta: { module: 'ai-ocr', requestId: 'f8a3c2d1-1111-2222-3333-444455556666' },
    })!;
    expect(entry.module).toBe('ai-ocr');
    // The requestId is a UUID (hex groups < 4 consecutive digits stay intact
    // after scrubbing) — correlation must survive masking.
    expect(entry.requestId).toBe('f8a3c2d1-1111-2222-3333-444455556666');
  });

  it('omits undefined meta values', () => {
    const entry = buildLogEntry({ ...base, meta: { module: undefined, status: 500 } })!;
    expect('module' in entry).toBe(false);
    expect(entry.status).toBe(500);
  });
});
