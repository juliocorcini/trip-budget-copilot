import { describe, it, expect } from 'vitest';
import {
  buildConnectPayload,
  parseConnectPayload,
} from '@/domain/sync/connect-payload';
import {
  buildMailboxEnvelope,
  packEnvelope,
  unpackEnvelope,
} from '@/domain/sync/mailbox-envelope';

// DEC-344 (G6): the `connect` payload is the reverse half of a two-way pairing —
// the scanner announces its own identity to the peer so BOTH devices appear on
// each other's phones without a second scan. It must validate strictly (it lands
// from the network) and survive the envelope round-trip the Worker forwards.

const ACTOR = 'a1b2c3d4-0000-4000-8000-000000000001';

describe('buildConnectPayload (DEC-344)', () => {
  it('carries the announcing device identity + public key', () => {
    const payload = buildConnectPayload({ actorId: ACTOR, name: 'Julio', pk: 'PUBKEYbase64url' });
    expect(payload).toEqual({ actorId: ACTOR, name: 'Julio', pk: 'PUBKEYbase64url' });
  });

  it('trims and caps the display name (mirrors the envelope name cap)', () => {
    const long = 'x'.repeat(120);
    const payload = buildConnectPayload({ actorId: ACTOR, name: `  ${long}  `, pk: 'pk' });
    expect(payload.name).toHaveLength(60);
    expect(payload.name.startsWith(' ')).toBe(false);
  });
});

describe('parseConnectPayload (DEC-344)', () => {
  it('accepts a well-formed payload', () => {
    const payload = buildConnectPayload({ actorId: ACTOR, name: 'Debora', pk: 'pk' });
    expect(parseConnectPayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it('rejects a non-uuid actorId, empty name, or missing key (fails closed)', () => {
    expect(parseConnectPayload({ actorId: 'not-a-uuid', name: 'X', pk: 'pk' })).toBeNull();
    expect(parseConnectPayload({ actorId: ACTOR, name: '', pk: 'pk' })).toBeNull();
    expect(parseConnectPayload({ actorId: ACTOR, name: 'X' })).toBeNull();
    expect(parseConnectPayload(null)).toBeNull();
    expect(parseConnectPayload('garbage')).toBeNull();
  });
});

describe('connect envelope round-trip (DEC-344 transport)', () => {
  it('packs and unpacks a connect envelope, preserving the payload', () => {
    const payload = buildConnectPayload({ actorId: ACTOR, name: 'Julio', pk: 'pk-xyz' });
    const envelope = buildMailboxEnvelope({
      kind: 'connect',
      fromActorId: ACTOR,
      fromName: 'Julio',
      data: payload,
    });
    const unpacked = unpackEnvelope(packEnvelope(envelope));
    expect(unpacked).not.toBeNull();
    expect(unpacked!.kind).toBe('connect');
    expect(parseConnectPayload(unpacked!.data)).toEqual(payload);
  });
});
