import { describe, it, expect } from 'vitest';
import {
  classifyScannedQr,
  encodeQrPayload,
  buildIdentityQrPayload,
  buildQrUrl,
  decodeQrPayload,
} from '@/domain/sync';

const ORIGIN = 'https://trippilot.pages.dev';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';

const identityEnvelope = encodeQrPayload(
  buildIdentityQrPayload({ actorId: ACTOR_ID, displayName: 'Marina' }),
);

const statementEnvelope = encodeQrPayload({
  v: 1,
  kind: 'statement',
  data: {
    v: 1,
    owner: { actorId: ACTOR_ID, name: 'Ana' },
    participantId: PARTICIPANT_ID,
    peerName: 'Bruno',
    currency: 'BRL',
    netCents: -1500,
    generatedAt: '2026-06-27T00:00:00.000Z',
    lines: [],
  },
});

const sessionEnvelope = encodeQrPayload({
  v: 1,
  kind: 'session',
  code: 'ABCD',
  key: '0123456789abcdef0',
  purpose: 'statement',
});

describe('classifyScannedQr (DEC-373 / G7 universal scan router)', () => {
  describe('identity (connect) → inline pair', () => {
    it('reads a raw TPSYNC1 identity envelope', () => {
      const result = classifyScannedQr(identityEnvelope);
      expect(result.kind).toBe('identity');
      if (result.kind === 'identity') expect(result.payload.actorId).toBe(ACTOR_ID);
    });

    it('reads an identity carried in a /pair#… URL', () => {
      const url = buildQrUrl('identity', identityEnvelope, ORIGIN);
      const result = classifyScannedQr(url);
      expect(result.kind).toBe('identity');
      if (result.kind === 'identity') expect(result.payload.name).toBe('Marina');
    });
  });

  describe('statement (extrato) → /sync', () => {
    it('reads a raw statement envelope and round-trips the encoded payload', () => {
      const result = classifyScannedQr(statementEnvelope);
      expect(result.kind).toBe('statement');
      if (result.kind === 'statement') {
        expect(decodeQrPayload(result.encoded)?.kind).toBe('statement');
      }
    });

    it('reads a statement carried in a /sync#… URL', () => {
      const url = buildQrUrl('statement', statementEnvelope, ORIGIN);
      const result = classifyScannedQr(url);
      expect(result.kind).toBe('statement');
    });
  });

  describe('live WebRTC handshake → carve-out (migration scanner only)', () => {
    it('classifies a session envelope as live_signal', () => {
      const result = classifyScannedQr(sessionEnvelope);
      expect(result.kind).toBe('live_signal');
      if (result.kind === 'live_signal') expect(result.envelope.kind).toBe('session');
    });
  });

  describe('owned app URLs → in-app navigation (any kind)', () => {
    it('routes a group /g/:id URL', () => {
      const result = classifyScannedQr(`${ORIGIN}/g/abc123`);
      expect(result).toEqual({ kind: 'app_route', route: '/g/abc123' });
    });

    it('routes a shared-link /s/:id URL preserving the #key fragment', () => {
      const result = classifyScannedQr(`${ORIGIN}/s/trip9#k=SECRETKEY`);
      expect(result).toEqual({ kind: 'app_route', route: '/s/trip9#k=SECRETKEY' });
    });

    it('routes a live-split /t/:id URL preserving the query', () => {
      const result = classifyScannedQr(`${ORIGIN}/t/board1?x=1`);
      expect(result).toEqual({ kind: 'app_route', route: '/t/board1?x=1' });
    });

    it('routes a payload-less /sync URL', () => {
      const result = classifyScannedQr(`${ORIGIN}/sync`);
      expect(result).toEqual({ kind: 'app_route', route: '/sync' });
    });
  });

  describe('unknown → "not a TripPilot code"', () => {
    it('rejects a foreign host', () => {
      expect(classifyScannedQr('https://example.com/g/abc').kind).toBe('unknown');
    });

    it('rejects a non-https owned URL', () => {
      expect(classifyScannedQr('http://trippilot.pages.dev/g/abc').kind).toBe('unknown');
    });

    it('rejects an unowned route on the app host', () => {
      expect(classifyScannedQr(`${ORIGIN}/dashboard`).kind).toBe('unknown');
    });

    it('rejects arbitrary text', () => {
      expect(classifyScannedQr('just some text').kind).toBe('unknown');
    });

    it('rejects empty / whitespace input', () => {
      expect(classifyScannedQr('   ').kind).toBe('unknown');
      expect(classifyScannedQr(null).kind).toBe('unknown');
    });
  });
});
