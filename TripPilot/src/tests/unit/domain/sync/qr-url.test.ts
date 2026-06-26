import { describe, it, expect } from 'vitest';
import {
  buildQrUrl,
  extractQrEnvelope,
  QR_URL_ROUTES,
  decodeQrPayload,
  encodeQrPayload,
  buildIdentityQrPayload,
} from '@/domain/sync';

const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const ENVELOPE = 'TPSYNC1:abcDEF_-0123456789'; // base64url + the `:` that must survive

describe('buildQrUrl (DEC-351 / F16)', () => {
  it('routes identity QRs to /pair and statement QRs to /sync', () => {
    expect(buildQrUrl('identity', ENVELOPE, 'https://x.dev').startsWith('https://x.dev/pair#')).toBe(
      true,
    );
    expect(buildQrUrl('statement', ENVELOPE, 'https://x.dev').startsWith('https://x.dev/sync#')).toBe(
      true,
    );
  });

  it('keeps the route table and the URLs in sync', () => {
    expect(buildQrUrl('identity', ENVELOPE, 'https://x.dev')).toContain(QR_URL_ROUTES.identity);
    expect(buildQrUrl('statement', ENVELOPE, 'https://x.dev')).toContain(QR_URL_ROUTES.statement);
  });

  it('strips a trailing slash from the origin so there is no double slash', () => {
    const url = buildQrUrl('identity', ENVELOPE, 'https://x.dev/');
    expect(url.startsWith('https://x.dev/pair#')).toBe(true);
    expect(url.includes('.dev//pair')).toBe(false);
  });

  it('percent-encodes the envelope into the fragment (a default camera opens a valid URL)', () => {
    const url = buildQrUrl('statement', ENVELOPE, 'https://x.dev');
    // The colon must be encoded so the whole string is a single valid URL.
    expect(url).toContain('%3A');
    expect(() => new URL(url)).not.toThrow();
  });
});

describe('extractQrEnvelope', () => {
  it('returns the fragment of an app URL (the QR→URL migration)', () => {
    const url = buildQrUrl('identity', ENVELOPE, 'https://x.dev');
    expect(extractQrEnvelope(url)).toBe(ENVELOPE);
  });

  it('returns a bare envelope unchanged (legacy raw QRs / live signaling QRs)', () => {
    expect(extractQrEnvelope(ENVELOPE)).toBe(ENVELOPE);
  });

  it('trims surrounding whitespace from a scan', () => {
    expect(extractQrEnvelope(`  ${ENVELOPE}  `)).toBe(ENVELOPE);
  });

  it('returns null for empty input and for a fragment-less hash', () => {
    expect(extractQrEnvelope('')).toBeNull();
    expect(extractQrEnvelope('   ')).toBeNull();
    expect(extractQrEnvelope('https://x.dev/sync#')).toBeNull();
  });

  it('falls back to the raw fragment when percent-decoding fails', () => {
    expect(extractQrEnvelope('https://x.dev/pair#%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('buildQrUrl <-> extractQrEnvelope round-trip', () => {
  it('recovers the exact envelope for every kind', () => {
    for (const kind of ['identity', 'statement'] as const) {
      const url = buildQrUrl(kind, ENVELOPE, 'https://trippilot.pages.dev');
      expect(extractQrEnvelope(url)).toBe(ENVELOPE);
    }
  });

  it('a real identity envelope survives the URL and still decodes', () => {
    const encoded = encodeQrPayload(
      buildIdentityQrPayload({ actorId: ACTOR_ID, displayName: 'Marina' }),
    );
    const url = buildQrUrl('identity', encoded, 'https://x.dev');
    const decoded = decodeQrPayload(extractQrEnvelope(url) ?? '');
    expect(decoded?.kind).toBe('identity');
    expect(decoded?.kind === 'identity' && decoded.actorId).toBe(ACTOR_ID);
  });
});
