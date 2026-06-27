import { describe, it, expect } from 'vitest';
import {
  buildGroupActivity,
  appendGroupActivity,
  GROUP_ACTIVITY_CAP,
} from '@/domain/group-split/group-activity';
import {
  buildGroupSharePayload,
  parseGroupSharePayload,
} from '@/domain/group-split/share-payload';
import { buildPaymentPayload, parsePaymentPayload } from '@/domain/sync/payment-payload';
import {
  buildGroupClaimResponse,
  parseGroupClaimResponse,
} from '@/domain/group-split/claim-response';
import type { GroupSplitEvent } from '@/domain/group-split/types';
import type { ImageRef } from '@/domain/media';

const PROOF: ImageRef = { r2Id: 'r2-proof-1', mime: 'image/jpeg', w: 800, h: 600 };
const THUMB = 'data:image/jpeg;base64,/9j/proofthumb';

function minimalEvent(activity: GroupSplitEvent['activity']): GroupSplitEvent {
  return {
    id: 'evt-1',
    name: 'Trip',
    currency: 'EUR',
    tripId: null,
    ownerParticipantId: 'p-owner',
    participants: [
      {
        id: 'p-owner',
        name: 'Me',
        kind: 'owner',
        linkedParticipantId: null,
        claimedByActorId: null,
        paymentStatus: 'unpaid',
      },
    ],
    expenses: [],
    status: 'open',
    createdAt: '2026-06-26T00:00:00.000Z',
    activity,
  };
}

describe('DEC-363 (Item D) — proof on a group payment activity', () => {
  it('carries proof + thumb on a payment_marked entry, and omits them when absent', () => {
    const withProof = buildGroupActivity({
      kind: 'payment_marked',
      actorName: 'Bruno',
      amountCents: 2000,
      proof: PROOF,
      proofThumb: THUMB,
    });
    expect(withProof.proof).toEqual(PROOF);
    expect(withProof.proofThumb).toBe(THUMB);

    const withoutProof = buildGroupActivity({ kind: 'payment_confirmed', actorName: 'Me' });
    expect(withoutProof.proof).toBeUndefined();
    expect(withoutProof.proofThumb).toBeUndefined();
  });

  it('preserves the proof through append + the cap trim', () => {
    let event = minimalEvent([]);
    event = appendGroupActivity(event, {
      kind: 'payment_marked',
      actorName: 'Bruno',
      amountCents: 2000,
      proof: PROOF,
      proofThumb: THUMB,
    });
    const marked = event.activity?.[0];
    expect(marked?.proof).toEqual(PROOF);

    // Overflow the cap with neutral entries; the proof entry is the oldest and is
    // trimmed away — the array stays bounded (no special-casing for proofs).
    for (let i = 0; i < GROUP_ACTIVITY_CAP + 5; i++) {
      event = appendGroupActivity(event, { kind: 'expense_added', actorName: 'Me', detail: `e${i}` });
    }
    expect(event.activity?.length).toBe(GROUP_ACTIVITY_CAP);
    expect(event.activity?.some((a) => a.proof)).toBe(false);
  });
});

describe('DEC-363 — group share payload round-trips a proof (and stays back-compat)', () => {
  it('round-trips an activity carrying proof + thumb', () => {
    const entry = buildGroupActivity({
      kind: 'payment_marked',
      actorName: 'Bruno',
      amountCents: 2000,
      proof: PROOF,
      proofThumb: THUMB,
    });
    const payload = buildGroupSharePayload(minimalEvent([entry]), 1);
    const parsed = parseGroupSharePayload(JSON.parse(JSON.stringify(payload)));
    expect(parsed).not.toBeNull();
    const round = parsed!.event.activity?.[0];
    expect(round?.proof).toEqual(PROOF);
    expect(round?.proofThumb).toBe(THUMB);
  });

  it('still parses a legacy activity with no proof field', () => {
    const entry = buildGroupActivity({ kind: 'payment_marked', actorName: 'Bruno', amountCents: 2000 });
    const payload = buildGroupSharePayload(minimalEvent([entry]), 1);
    const parsed = parseGroupSharePayload(JSON.parse(JSON.stringify(payload)));
    expect(parsed).not.toBeNull();
    expect(parsed!.event.activity?.[0]?.proof).toBeUndefined();
  });

  it('rejects a payload whose proof ref is malformed (missing r2Id)', () => {
    const payload = buildGroupSharePayload(minimalEvent([]), 1) as unknown as Record<string, unknown>;
    const event = payload.event as Record<string, unknown>;
    event.activity = [
      {
        id: 'a1',
        ts: '2026-06-26T00:00:00.000Z',
        actorId: null,
        actorName: 'Bruno',
        kind: 'payment_marked',
        proof: { mime: 'image/jpeg', w: 1, h: 1 }, // no r2Id
      },
    ];
    expect(parseGroupSharePayload(payload)).toBeNull();
  });
});

describe('DEC-363 — P2P payment payload carries an optional proof', () => {
  const base = {
    paymentId: '11111111-1111-4111-8111-111111111111',
    fromActorId: '22222222-2222-4222-8222-222222222222',
    fromName: 'Bruno',
    currency: 'EUR',
    amountCents: 2000,
    direction: 'paid' as const,
  };

  it('builds + parses a payment with proof + thumb', () => {
    const payload = buildPaymentPayload({ ...base, proof: PROOF, proofThumb: THUMB });
    expect(payload.proof).toEqual(PROOF);
    expect(payload.proofThumb).toBe(THUMB);
    const parsed = parsePaymentPayload(JSON.parse(JSON.stringify(payload)));
    expect(parsed?.proof).toEqual(PROOF);
    expect(parsed?.proofThumb).toBe(THUMB);
  });

  it('omits proof fields when none is attached (back-compat)', () => {
    const payload = buildPaymentPayload(base);
    expect(payload.proof).toBeUndefined();
    expect(payload.proofThumb).toBeUndefined();
    const parsed = parsePaymentPayload(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.proof).toBeUndefined();
  });
});

describe('DEC-363 — group claim response attaches a proof only with a paid assertion', () => {
  const base = {
    fromActorId: 'actor-guest',
    fromName: 'Bruno',
    claimedParticipantId: 'p-bruno',
  };

  it('keeps proof + thumb when the guest marks paid, and round-trips them', () => {
    const response = buildGroupClaimResponse({ ...base, markedPaid: true, proof: PROOF, proofThumb: THUMB });
    expect(response.proof).toEqual(PROOF);
    expect(response.proofThumb).toBe(THUMB);
    const parsed = parseGroupClaimResponse(JSON.parse(JSON.stringify(response)));
    expect(parsed?.proof).toEqual(PROOF);
    expect(parsed?.proofThumb).toBe(THUMB);
  });

  it('drops the proof when the guest is NOT marking paid (no orphan proof)', () => {
    const response = buildGroupClaimResponse({ ...base, markedPaid: false, proof: PROOF, proofThumb: THUMB });
    expect(response.proof).toBeUndefined();
    expect(response.proofThumb).toBeUndefined();
  });

  it('still parses a legacy claim response with no proof (back-compat)', () => {
    const response = buildGroupClaimResponse({ ...base, markedPaid: true });
    const parsed = parseGroupClaimResponse(JSON.parse(JSON.stringify(response)));
    expect(parsed).not.toBeNull();
    expect(parsed?.markedPaid).toBe(true);
    expect(parsed?.proof).toBeUndefined();
  });

  it('rejects a claim response whose proof ref is malformed (missing r2Id)', () => {
    const raw = {
      v: 1,
      fromActorId: 'actor-guest',
      fromName: 'Bruno',
      claimedParticipantId: 'p-bruno',
      markedPaid: true,
      proof: { mime: 'image/jpeg', w: 1, h: 1 },
      at: '2026-06-26T00:00:00.000Z',
    };
    expect(parseGroupClaimResponse(raw)).toBeNull();
  });
});
