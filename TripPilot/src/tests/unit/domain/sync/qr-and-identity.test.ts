import { describe, it, expect } from 'vitest';
import {
  buildIdentityQrPayload,
  parseIdentityQrPayload,
  encodeQrPayload,
  decodeQrPayload,
  fitsInSingleQr,
  SINGLE_QR_LIMIT_CHARS,
} from '@/domain/sync';
import type { SessionQrPayload } from '@/domain/sync';

const ACTOR_ID = '4f9c8a52-1234-4abc-9def-0123456789ab';

describe('identity QR payload', () => {
  it('builds and parses an identity round-trip', () => {
    const payload = buildIdentityQrPayload({ actorId: ACTOR_ID, displayName: '  Julio  ' });
    expect(payload).toEqual({ v: 1, kind: 'identity', actorId: ACTOR_ID, name: 'Julio' });
    expect(parseIdentityQrPayload(payload)).toEqual(payload);
  });

  it('rejects malformed identity payloads', () => {
    expect(parseIdentityQrPayload({ v: 1, kind: 'identity', actorId: 'nope', name: 'x' })).toBeNull();
    expect(parseIdentityQrPayload({ v: 2, kind: 'identity', actorId: ACTOR_ID, name: 'x' })).toBeNull();
    expect(parseIdentityQrPayload(null)).toBeNull();
  });
});

describe('QR codec envelope', () => {
  it('round-trips identity and session payloads through the codec', () => {
    const identity = buildIdentityQrPayload({ actorId: ACTOR_ID, displayName: 'Julio' });
    const encoded = encodeQrPayload(identity);
    expect(encoded.startsWith('TPSYNC1:')).toBe(true);
    expect(decodeQrPayload(encoded)).toEqual(identity);

    const session: SessionQrPayload = {
      v: 1,
      kind: 'session',
      code: 'A7K9M2',
      key: 'a'.repeat(43),
      purpose: 'migration',
    };
    expect(decodeQrPayload(encodeQrPayload(session))).toEqual(session);
  });

  it('identity and session QRs always fit a single QR', () => {
    const identity = buildIdentityQrPayload({ actorId: ACTOR_ID, displayName: 'J'.repeat(60) });
    expect(fitsInSingleQr(encodeQrPayload(identity))).toBe(true);
  });

  it('rejects foreign or corrupted strings', () => {
    expect(decodeQrPayload('https://example.com')).toBeNull();
    expect(decodeQrPayload('TPSYNC1:!!!notbase64!!!')).toBeNull();
    expect(decodeQrPayload('TPSYNC1:QUJDRA')).toBeNull();
  });

  it('exposes a conservative single-QR limit', () => {
    expect(SINGLE_QR_LIMIT_CHARS).toBeLessThanOrEqual(2000);
    expect(fitsInSingleQr('x'.repeat(SINGLE_QR_LIMIT_CHARS + 1))).toBe(false);
  });
});
