import { describe, it, expect } from 'vitest';
import {
  buildPairLink,
  pairLinkFromEncoded,
  parsePairIdentityFromHash,
  buildIdentityQrPayload,
  encodeQrPayload,
} from '@/domain/sync';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const NAME = 'Marina';
const PK = 'abcDEF_-0123456789';

describe('buildPairLink', () => {
  it('points at /pair and carries the identity in the fragment', () => {
    const url = buildPairLink('https://trippilot.pages.dev', { actorId: ACTOR_ID, displayName: NAME }, PK);
    expect(url.startsWith('https://trippilot.pages.dev/pair#')).toBe(true);
  });

  it('strips a trailing slash from the origin so there is no double slash', () => {
    const url = buildPairLink('https://trippilot.pages.dev/', { actorId: ACTOR_ID, displayName: NAME });
    expect(url.startsWith('https://trippilot.pages.dev/pair#')).toBe(true);
    expect(url.includes('.dev//pair')).toBe(false);
  });

  it('round-trips the identity (actorId + name + public key) through the URL hash', () => {
    const url = buildPairLink('https://x.dev', { actorId: ACTOR_ID, displayName: NAME }, PK);
    const identity = parsePairIdentityFromHash(new URL(url).hash);
    expect(identity).not.toBeNull();
    expect(identity?.actorId).toBe(ACTOR_ID);
    expect(identity?.name).toBe(NAME);
    expect(identity?.pk).toBe(PK);
  });

  it('omits the public key when none is provided', () => {
    const url = buildPairLink('https://x.dev', { actorId: ACTOR_ID, displayName: NAME });
    const identity = parsePairIdentityFromHash(new URL(url).hash);
    expect(identity?.pk).toBeUndefined();
  });
});

describe('pairLinkFromEncoded / parsePairIdentityFromHash', () => {
  const encoded = encodeQrPayload(buildIdentityQrPayload({ actorId: ACTOR_ID, displayName: NAME }, PK));

  it('round-trips an already-encoded identity envelope', () => {
    const url = pairLinkFromEncoded('https://x.dev', encoded);
    const identity = parsePairIdentityFromHash(new URL(url).hash);
    expect(identity?.actorId).toBe(ACTOR_ID);
  });

  it('tolerates a hash without a leading # and a non-percent-encoded payload', () => {
    expect(parsePairIdentityFromHash(encoded)?.actorId).toBe(ACTOR_ID);
    expect(parsePairIdentityFromHash(`#${encoded}`)?.actorId).toBe(ACTOR_ID);
  });

  it('returns null for an empty hash', () => {
    expect(parsePairIdentityFromHash('')).toBeNull();
    expect(parsePairIdentityFromHash('#')).toBeNull();
  });

  it('returns null for junk that is not a TripPilot envelope', () => {
    expect(parsePairIdentityFromHash('#not-a-real-payload')).toBeNull();
  });

  it('returns null for a valid envelope that is not an identity (kind guard)', () => {
    const session = encodeQrPayload({
      v: 1,
      kind: 'session',
      code: 'ABCD',
      key: '0123456789abcdef',
      purpose: 'statement',
    });
    expect(parsePairIdentityFromHash(`#${session}`)).toBeNull();
  });
});
