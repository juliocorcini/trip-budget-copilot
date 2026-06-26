import { describe, it, expect } from 'vitest';
import {
  createGroupSplitEvent,
  createGroupParticipant,
  buildGroupExpense,
  addParticipant,
  addExpense,
  setParticipantPayment,
  buildGroupSharePayload,
  parseGroupSharePayload,
  buildGroupClaimResponse,
  parseGroupClaimResponse,
  reduceGroupClaims,
} from '@/domain/group-split';
import type { GroupSplitEvent } from '@/domain/group-split';

/** Builds the canonical 3-person "churrasco" event A(owner)/B/C with one expense. */
function buildAbcEvent(): { event: GroupSplitEvent; a: string; b: string; c: string } {
  let event = createGroupSplitEvent({ name: 'Churrasco', currency: 'EUR', ownerName: 'Ana' });
  const a = event.ownerParticipantId;
  const bruno = createGroupParticipant({ name: 'Bruno' });
  const carla = createGroupParticipant({ name: 'Carla' });
  event = addParticipant(addParticipant(event, bruno), carla);
  // Ana fronts a 90.00 expense split equally three ways → B and C each owe 30.00.
  event = addExpense(
    event,
    buildGroupExpense({
      description: 'Meat',
      amountCents: 9000,
      paidByParticipantId: a,
      splitMode: 'equal',
      participantIds: [a, bruno.id, carla.id],
    }),
  );
  return { event, a, b: bruno.id, c: carla.id };
}

describe('group share-payload (C23/DEC-297 public link)', () => {
  it('round-trips an event through build → parse unchanged', () => {
    const { event } = buildAbcEvent();
    const payload = buildGroupSharePayload(event, 3);
    const json = JSON.parse(JSON.stringify(payload));
    const parsed = parseGroupSharePayload(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.v).toBe(1);
    expect(parsed!.revision).toBe(3);
    expect(parsed!.event).toEqual(event);
  });

  it('floors a negative revision to 0', () => {
    const { event } = buildAbcEvent();
    expect(buildGroupSharePayload(event, -5).revision).toBe(0);
  });

  it('preserves the additive expense fields (occurredAt/registrant/items) over the link', () => {
    const { event, a, b } = buildAbcEvent();
    const withMeta = addExpense(
      event,
      buildGroupExpense({
        description: 'Mercado',
        amountCents: 1200,
        paidByParticipantId: a,
        splitMode: 'equal',
        participantIds: [a, b],
        occurredAt: '2026-06-20',
        createdByParticipantId: b,
        items: [{ id: 'i1', description: 'Pão', amountCents: 1200, qty: 1 }],
      }),
    );
    const json = JSON.parse(JSON.stringify(buildGroupSharePayload(withMeta, 1)));
    const parsed = parseGroupSharePayload(json);
    expect(parsed).not.toBeNull();
    const round = parsed!.event.expenses.find((e) => e.description === 'Mercado')!;
    expect(round.occurredAt).toBe('2026-06-20');
    expect(round.createdByParticipantId).toBe(b);
    expect(round.items).toEqual([{ id: 'i1', description: 'Pão', amountCents: 1200, qty: 1 }]);
  });

  it('rejects a corrupt/foreign payload with null (broken link, never throws)', () => {
    expect(parseGroupSharePayload({ v: 2, event: {} })).toBeNull();
    expect(parseGroupSharePayload('garbage')).toBeNull();
    expect(parseGroupSharePayload(null)).toBeNull();
  });
});

describe('group claim-response (guest → owner snapshot)', () => {
  it('builds + parses a claim and defaults a blank name', () => {
    const res = buildGroupClaimResponse({
      fromActorId: 'dev-1',
      fromName: '   ',
      claimedParticipantId: 'p-b',
      markedPaid: true,
    });
    expect(res.fromName).toBe('Convidado');
    const parsed = parseGroupClaimResponse(JSON.parse(JSON.stringify(res)));
    expect(parsed).not.toBeNull();
    expect(parsed!.claimedParticipantId).toBe('p-b');
    expect(parsed!.markedPaid).toBe(true);
  });

  it('rejects a malformed claim with null', () => {
    expect(parseGroupClaimResponse({ v: 1, fromActorId: '', claimedParticipantId: 'x' })).toBeNull();
  });
});

describe('reduceGroupClaims (owner-authoritative reducer)', () => {
  it('binds a guest device to the slot it picked and escalates to marked', () => {
    const { event, b } = buildAbcEvent();
    const claim = buildGroupClaimResponse({
      fromActorId: 'dev-bruno',
      fromName: 'Bruno',
      claimedParticipantId: b,
      markedPaid: true,
    });
    const next = reduceGroupClaims(event, [claim]);
    const slot = next.participants.find((p) => p.id === b)!;
    expect(slot.claimedByActorId).toBe('dev-bruno');
    expect(slot.paymentStatus).toBe('marked');
  });

  it('never lets a guest claim the owner slot', () => {
    const { event, a } = buildAbcEvent();
    const spoof = buildGroupClaimResponse({
      fromActorId: 'attacker',
      fromName: 'Ana',
      claimedParticipantId: a,
      markedPaid: true,
    });
    const next = reduceGroupClaims(event, [spoof]);
    const owner = next.participants.find((p) => p.id === a)!;
    expect(owner.claimedByActorId).toBeNull();
    expect(owner.paymentStatus).toBe('unpaid');
  });

  it('never downgrades a slot the owner already confirmed', () => {
    const { event, b } = buildAbcEvent();
    const confirmed = setParticipantPayment(event, b, 'confirmed');
    const unmark = buildGroupClaimResponse({
      fromActorId: 'dev-bruno',
      fromName: 'Bruno',
      claimedParticipantId: b,
      markedPaid: false,
    });
    const next = reduceGroupClaims(confirmed, [unmark]);
    expect(next.participants.find((p) => p.id === b)!.paymentStatus).toBe('confirmed');
  });

  it('lets a guest un-mark while still only "marked" (not yet confirmed)', () => {
    const { event, b } = buildAbcEvent();
    const marked = reduceGroupClaims(event, [
      buildGroupClaimResponse({ fromActorId: 'dev-b', fromName: 'B', claimedParticipantId: b, markedPaid: true }),
    ]);
    expect(marked.participants.find((p) => p.id === b)!.paymentStatus).toBe('marked');
    const unmarked = reduceGroupClaims(marked, [
      buildGroupClaimResponse({ fromActorId: 'dev-b', fromName: 'B', claimedParticipantId: b, markedPaid: false }),
    ]);
    expect(unmarked.participants.find((p) => p.id === b)!.paymentStatus).toBe('unpaid');
  });

  it('keeps the latest snapshot per device and releases a stale slot on switch', () => {
    const { event, b, c } = buildAbcEvent();
    const first = buildGroupClaimResponse({
      fromActorId: 'dev-x',
      fromName: 'X',
      claimedParticipantId: b,
      markedPaid: false,
    });
    const second = {
      ...buildGroupClaimResponse({ fromActorId: 'dev-x', fromName: 'X', claimedParticipantId: c, markedPaid: true }),
      at: '2999-01-01T00:00:00.000Z',
    };
    const next = reduceGroupClaims(event, [first, second]);
    expect(next.participants.find((p) => p.id === b)!.claimedByActorId).toBeNull();
    const slotC = next.participants.find((p) => p.id === c)!;
    expect(slotC.claimedByActorId).toBe('dev-x');
    expect(slotC.paymentStatus).toBe('marked');
  });

  it('is idempotent — re-folding the same batch yields an equal event', () => {
    const { event, b } = buildAbcEvent();
    const batch = [
      buildGroupClaimResponse({ fromActorId: 'dev-b', fromName: 'B', claimedParticipantId: b, markedPaid: true }),
    ];
    const once = reduceGroupClaims(event, batch);
    const twice = reduceGroupClaims(once, batch);
    expect(twice.participants).toEqual(once.participants);
  });
});
