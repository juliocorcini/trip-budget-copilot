import { describe, it, expect } from 'vitest';
import {
  buildTelemetryPayload,
  deriveTelemetryFlags,
  scrubErrorMessage,
  selectErrorReports,
  shouldSendHeartbeat,
  utcDayKey,
  type TelemetryCounts,
  type TelemetryFlags,
} from '@/domain/telemetry';

const FULL_COUNTS: TelemetryCounts = {
  trips: 3,
  expenses: 42,
  outings: 5,
  splits: 7,
  settlements: 2,
  plannedPurchases: 4,
  wallets: 2,
  participants: 6,
  connections: 3,
  aiEntries: 11,
  receiptScans: 8,
  crashes: 1,
};

const FULL_FLAGS: TelemetryFlags = {
  usesAI: true,
  usesReceiptOcr: false,
  usesSplit: true,
  usesWallets: true,
  usesLocation: false,
  usesAppLock: true,
  isNative: false,
};

describe('utcDayKey', () => {
  it('returns the UTC calendar day as YYYY-MM-DD', () => {
    // 2026-06-21T03:25:00Z → still 2026-06-21 in UTC.
    expect(utcDayKey(Date.parse('2026-06-21T03:25:00Z'))).toBe('2026-06-21');
  });

  it('uses UTC, not local time, at the day boundary', () => {
    // 23:30Z on the 20th is the 20th in UTC regardless of the machine TZ.
    expect(utcDayKey(Date.parse('2026-06-20T23:30:00Z'))).toBe('2026-06-20');
    expect(utcDayKey(Date.parse('2026-06-21T00:10:00Z'))).toBe('2026-06-21');
  });
});

describe('shouldSendHeartbeat', () => {
  it('sends when never sent before', () => {
    expect(shouldSendHeartbeat(null, '2026-06-21')).toBe(true);
  });

  it('sends once per UTC day', () => {
    expect(shouldSendHeartbeat('2026-06-20', '2026-06-21')).toBe(true);
  });

  it('does not re-send on the same day', () => {
    expect(shouldSendHeartbeat('2026-06-21', '2026-06-21')).toBe(false);
  });
});

describe('deriveTelemetryFlags', () => {
  const base = {
    aiQuickEntryEnabled: false,
    cloudReceiptOcrEnabled: false,
    locationCaptureEnabled: false,
    appLockEnabled: false,
    isNative: false,
    splits: 0,
    wallets: 1,
  };

  it('marks usesSplit only when at least one split exists', () => {
    expect(deriveTelemetryFlags({ ...base, splits: 0 }).usesSplit).toBe(false);
    expect(deriveTelemetryFlags({ ...base, splits: 1 }).usesSplit).toBe(true);
  });

  it('marks usesWallets only with MORE than one wallet (a lone wallet is the implicit default)', () => {
    expect(deriveTelemetryFlags({ ...base, wallets: 1 }).usesWallets).toBe(false);
    expect(deriveTelemetryFlags({ ...base, wallets: 2 }).usesWallets).toBe(true);
  });

  it('passes the settings booleans straight through', () => {
    const flags = deriveTelemetryFlags({
      ...base,
      aiQuickEntryEnabled: true,
      cloudReceiptOcrEnabled: true,
      locationCaptureEnabled: true,
      appLockEnabled: true,
      isNative: true,
    });
    expect(flags.usesAI).toBe(true);
    expect(flags.usesReceiptOcr).toBe(true);
    expect(flags.usesLocation).toBe(true);
    expect(flags.usesAppLock).toBe(true);
    expect(flags.isNative).toBe(true);
  });
});

describe('buildTelemetryPayload', () => {
  const baseInput = {
    installId: 'a1b2c3d4-0000-1111-2222-333344445555',
    nowMs: Date.parse('2026-06-21T10:00:00Z'),
    displayName: 'Julio',
    appVersion: '0.99.35',
    platform: 'web',
    browser: 'Chrome',
    locale: 'pt-BR',
    counts: FULL_COUNTS,
    flags: FULL_FLAGS,
  };

  it('keeps the install id, version, platform, locale and computed UTC day', () => {
    const p = buildTelemetryPayload(baseInput);
    expect(p.installId).toBe('a1b2c3d4-0000-1111-2222-333344445555');
    expect(p.appVersion).toBe('0.99.35');
    expect(p.platform).toBe('web');
    expect(p.browser).toBe('Chrome');
    expect(p.locale).toBe('pt-BR');
    expect(p.day).toBe('2026-06-21');
  });

  it('folds a null/blank browser family to null (old clients / unknown UA)', () => {
    expect(buildTelemetryPayload({ ...baseInput, browser: null }).browser).toBeNull();
    expect(buildTelemetryPayload({ ...baseInput, browser: '   ' }).browser).toBeNull();
  });

  it('carries every non-monetary counter verbatim', () => {
    const p = buildTelemetryPayload(baseInput);
    expect(p.counters).toEqual({
      trips: 3,
      expenses: 42,
      outings: 5,
      splits: 7,
      settlements: 2,
      plannedPurchases: 4,
      wallets: 2,
      participants: 6,
      connections: 3,
      aiEntries: 11,
      receiptScans: 8,
      crashes: 1,
    });
  });

  it('serializes flags as 0/1', () => {
    const p = buildTelemetryPayload(baseInput);
    expect(p.flags).toEqual({
      usesAI: 1,
      usesReceiptOcr: 0,
      usesSplit: 1,
      usesWallets: 1,
      usesLocation: 0,
      usesAppLock: 1,
      isNative: 0,
    });
  });

  it('clamps negative / NaN / fractional counts to safe non-negative integers', () => {
    const p = buildTelemetryPayload({
      ...baseInput,
      counts: { ...FULL_COUNTS, trips: -5, expenses: Number.NaN, splits: 7.9 },
    });
    expect(p.counters.trips).toBe(0);
    expect(p.counters.expenses).toBe(0);
    expect(p.counters.splits).toBe(7);
  });

  it('caps an absurd count so a bad client cannot poison the store', () => {
    const p = buildTelemetryPayload({
      ...baseInput,
      counts: { ...FULL_COUNTS, expenses: 9_999_999_999 },
    });
    expect(p.counters.expenses).toBe(100_000_000);
  });

  it('trims the display name and folds an empty name to null', () => {
    expect(buildTelemetryPayload({ ...baseInput, displayName: '  Julio  ' }).displayName).toBe('Julio');
    expect(buildTelemetryPayload({ ...baseInput, displayName: '   ' }).displayName).toBeNull();
    expect(buildTelemetryPayload({ ...baseInput, displayName: null }).displayName).toBeNull();
  });

  it('truncates an over-long name to 60 chars', () => {
    const long = 'x'.repeat(200);
    expect(buildTelemetryPayload({ ...baseInput, displayName: long }).displayName).toHaveLength(60);
  });
});

// DEC-251 (Onda B) — anonymous error capture scrub + selection policy.
describe('scrubErrorMessage', () => {
  it('collapses whitespace runs into single spaces and trims the ends', () => {
    expect(scrubErrorMessage('  Cannot   read \n property\tx  ')).toBe('Cannot read property x');
  });

  it('replaces long digit runs (ids, money, tokens, timestamps) with #', () => {
    // 4+ digit runs are masked; short runs (a 1-3 digit code) survive.
    expect(scrubErrorMessage('Failed at 1718900000000 for trip 12345')).toBe('Failed at # for trip #');
    expect(scrubErrorMessage('HTTP 404 on /assistant')).toBe('HTTP 404 on /assistant');
  });

  it('masks a monetary-looking value so it never reaches the server', () => {
    expect(scrubErrorMessage('total 123456 cents overflow')).toBe('total # cents overflow');
  });

  it('caps the message at 240 characters', () => {
    expect(scrubErrorMessage('e'.repeat(500))).toHaveLength(240);
  });

  it('returns empty string for a non-string input', () => {
    // Defensive: the worker mirror also guards this across the trust boundary.
    expect(scrubErrorMessage(undefined as unknown as string)).toBe('');
    expect(scrubErrorMessage(42 as unknown as string)).toBe('');
  });
});

describe('selectErrorReports', () => {
  const entries = [
    { timestamp: 100, message: 'old crash A' },
    { timestamp: 200, message: 'crash with id 99999' },
    { timestamp: 300, message: '   ' },
    { timestamp: 400, message: 'newest crash' },
  ];

  it('reports only entries newer than the last flush, scrubbed', () => {
    const result = selectErrorReports(entries, 150);
    expect(result.messages).toEqual(['crash with id #', 'newest crash']);
  });

  it('advances the high-water mark to the newest entry seen', () => {
    expect(selectErrorReports(entries, 150).lastFlushedAt).toBe(400);
  });

  it('keeps the previous mark when nothing is newer (no regression)', () => {
    expect(selectErrorReports(entries, 400).lastFlushedAt).toBe(400);
    expect(selectErrorReports(entries, 400).messages).toEqual([]);
  });

  it('drops entries that scrub down to an empty string', () => {
    // The whitespace-only entry at t=300 is newer than the mark but yields no
    // message, yet still pushes the high-water mark forward so it is not retried.
    const result = selectErrorReports(entries, 250);
    expect(result.messages).toEqual(['newest crash']);
    expect(result.lastFlushedAt).toBe(400);
  });

  it('reports everything when never flushed before', () => {
    expect(selectErrorReports(entries, 0).messages).toEqual([
      'old crash A',
      'crash with id #',
      'newest crash',
    ]);
  });
});
