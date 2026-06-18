import { describe, it, expect } from 'vitest';
import {
  buildSplitSharePayload,
  parseSplitSharePayload,
  createSplitSession,
  createSplitItem,
} from '@/domain/split';

function makeSession() {
  return createSplitSession({
    tripId: null,
    phaseId: null,
    name: 'Jantar',
    currency: 'EUR',
    ownerName: 'Eu',
    items: [createSplitItem({ description: 'Pizza', amountCents: 2400 })],
  });
}

describe('split share payload (G2 live table link)', () => {
  it('stamps version, revision and timestamp around the session', () => {
    const session = makeSession();
    const payload = buildSplitSharePayload(session, 3);
    expect(payload.v).toBe(1);
    expect(payload.revision).toBe(3);
    expect(payload.session.id).toBe(session.id);
    expect(payload.session.items).toHaveLength(1);
    expect(typeof payload.generatedAt).toBe('string');
  });

  it('floors a fractional revision and clamps a negative one to 0', () => {
    const session = makeSession();
    expect(buildSplitSharePayload(session, 2.9).revision).toBe(2);
    expect(buildSplitSharePayload(session, -5).revision).toBe(0);
  });

  it('round-trips through JSON (the encrypt → decrypt boundary)', () => {
    const payload = buildSplitSharePayload(makeSession(), 1);
    const wire = JSON.parse(JSON.stringify(payload));
    const parsed = parseSplitSharePayload(wire);
    expect(parsed).not.toBeNull();
    expect(parsed!.session.name).toBe('Jantar');
    expect(parsed!.session.participants[0]!.kind).toBe('owner');
  });

  it('rejects malformed or hostile blobs (defensive — broken link, not a crash)', () => {
    expect(parseSplitSharePayload(null)).toBeNull();
    expect(parseSplitSharePayload({})).toBeNull();
    expect(parseSplitSharePayload({ v: 2, session: {} })).toBeNull();
    const bad = buildSplitSharePayload(makeSession(), 1) as unknown as { session: { mode: string } };
    bad.session.mode = 'weird-mode';
    expect(parseSplitSharePayload(bad)).toBeNull();
  });
});
