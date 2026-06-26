import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGroupSplitEvent,
  createGroupParticipant,
  buildGroupExpense,
  addParticipant,
  addExpense,
  removeExpense,
  computeGroupBalances,
  setParticipantPayment,
  buildGroupSharePayload,
  parseGroupSharePayload,
  buildGroupClaimResponse,
  parseGroupClaimResponse,
  reduceGroupClaims,
} from '@/domain/group-split';
import type { GroupSplitEvent, GroupClaimExpense } from '@/domain/group-split';
import {
  isAutoAcceptInviter,
  addAutoAcceptInviter,
  removeAutoAcceptInviter,
  listAutoAcceptInviters,
} from '@/features/group-split/group-link';

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

describe('reduceGroupClaims — guest-authored expenses (DEC-340 add-or-retract)', () => {
  // A claim snapshot from `actor` claiming `slot`, carrying `expenses`.
  function claimWith(expenses: GroupClaimExpense[], actor: string, slot: string) {
    return buildGroupClaimResponse({
      fromActorId: actor,
      fromName: 'Bruno',
      claimedParticipantId: slot,
      markedPaid: false,
      expenses,
    });
  }

  it('folds an authored expense, stamps the author, and balances stay cents-exact', () => {
    const { event, a, b, c } = buildAbcEvent();
    const exp: GroupClaimExpense = { id: 'g:dev-bruno:1', description: 'Bebida', amountCents: 3000, paidByParticipantId: b, splitMode: 'equal', participantIds: [a, b, c] };
    const next = reduceGroupClaims(event, [claimWith([exp], 'dev-bruno', b)]);
    const folded = next.expenses.find((e) => e.id === 'g:dev-bruno:1');
    expect(folded).toBeTruthy();
    expect(folded!.authoredByActorId).toBe('dev-bruno');
    expect(folded!.source).toBe('manual');
    // A paid 9000 (share 4000) = +5000; B paid 3000 (share 4000) = -1000; C = -4000.
    const byId = new Map(computeGroupBalances(next).map((x) => [x.participantId, x.netCents]));
    expect(byId.get(a)).toBe(5000);
    expect(byId.get(b)).toBe(-1000);
    expect(byId.get(c)).toBe(-4000);
    expect([...byId.values()].reduce((s, n) => s + n, 0)).toBe(0);
  });

  it('is idempotent — re-folding never duplicates and keeps the first stamp', () => {
    const { event, a, b, c } = buildAbcEvent();
    const exp: GroupClaimExpense = { id: 'g:dev-bruno:1', description: 'Bebida', amountCents: 3000, paidByParticipantId: b, splitMode: 'equal', participantIds: [a, b, c] };
    const once = reduceGroupClaims(event, [claimWith([exp], 'dev-bruno', b)]);
    const twice = reduceGroupClaims(once, [claimWith([exp], 'dev-bruno', b)]);
    expect(twice.expenses.filter((e) => e.id === 'g:dev-bruno:1')).toHaveLength(1);
    expect(twice.expenses).toEqual(once.expenses);
  });

  it('retracts an authored expense the author dropped from their snapshot', () => {
    const { event, a, b, c } = buildAbcEvent();
    const exp: GroupClaimExpense = { id: 'g:dev-bruno:1', description: 'Bebida', amountCents: 3000, paidByParticipantId: b, splitMode: 'equal', participantIds: [a, b, c] };
    const folded = reduceGroupClaims(event, [claimWith([exp], 'dev-bruno', b)]);
    expect(folded.expenses.some((e) => e.id === 'g:dev-bruno:1')).toBe(true);
    const retracted = reduceGroupClaims(folded, [claimWith([], 'dev-bruno', b)]);
    expect(retracted.expenses.some((e) => e.id === 'g:dev-bruno:1')).toBe(false);
  });

  it('never overwrites an already-folded expense (owner is the authority)', () => {
    const { event, a, b, c } = buildAbcEvent();
    const exp: GroupClaimExpense = { id: 'g:dev-bruno:1', description: 'Bebida', amountCents: 3000, paidByParticipantId: b, splitMode: 'equal', participantIds: [a, b, c] };
    const folded = reduceGroupClaims(event, [claimWith([exp], 'dev-bruno', b)]);
    const tampered: GroupClaimExpense = { ...exp, amountCents: 999999, description: 'HACK' };
    const after = reduceGroupClaims(folded, [claimWith([tampered], 'dev-bruno', b)]);
    const still = after.expenses.find((e) => e.id === 'g:dev-bruno:1')!;
    expect(still.amountCents).toBe(3000);
    expect(still.description).toBe('Bebida');
  });

  it('owner removal tombstones it so a stale snapshot cannot resurrect it', () => {
    const { event, a, b, c } = buildAbcEvent();
    const exp: GroupClaimExpense = { id: 'g:dev-bruno:1', description: 'Bebida', amountCents: 3000, paidByParticipantId: b, splitMode: 'equal', participantIds: [a, b, c] };
    const folded = reduceGroupClaims(event, [claimWith([exp], 'dev-bruno', b)]);
    const removed = removeExpense(folded, 'g:dev-bruno:1');
    expect(removed.hiddenExpenseIds).toContain('g:dev-bruno:1');
    const reposted = reduceGroupClaims(removed, [claimWith([exp], 'dev-bruno', b)]);
    expect(reposted.expenses.some((e) => e.id === 'g:dev-bruno:1')).toBe(false);
  });

  it('drops claims that reference unknown participants or non-positive amounts', () => {
    const { event, a, b, c } = buildAbcEvent();
    const badPayer = claimWith(
      [{ id: 'g:x:1', description: 'X', amountCents: 1000, paidByParticipantId: 'ghost', splitMode: 'equal', participantIds: [a, b] }],
      'dev-x',
      c,
    );
    const unknownShare = claimWith(
      [{ id: 'g:y:1', description: 'Y', amountCents: 1000, paidByParticipantId: a, splitMode: 'equal', participantIds: [a, 'ghost'] }],
      'dev-y',
      c,
    );
    const next = reduceGroupClaims(event, [badPayer, unknownShare]);
    expect(next.expenses.some((e) => e.id === 'g:x:1')).toBe(false);
    expect(next.expenses.some((e) => e.id === 'g:y:1')).toBe(false);
    // The event's original single expense is untouched.
    expect(next.expenses).toHaveLength(1);
  });
});

describe('auto-accept allowlist (G_last, DEC-355 — trusted inviters)', () => {
  beforeEach(() => localStorage.clear());

  it('an unknown inviter is never auto-accepted; opting in flips it', () => {
    expect(isAutoAcceptInviter('actor-bruno')).toBe(false);
    addAutoAcceptInviter('actor-bruno', 'Bruno');
    expect(isAutoAcceptInviter('actor-bruno')).toBe(true);
  });

  it('removing an inviter restores the prompt (future invites are not silent)', () => {
    addAutoAcceptInviter('actor-bruno', 'Bruno');
    removeAutoAcceptInviter('actor-bruno');
    expect(isAutoAcceptInviter('actor-bruno')).toBe(false);
  });

  it('an empty actorId is never trusted and is never written (defensive)', () => {
    addAutoAcceptInviter('', 'Ghost');
    expect(isAutoAcceptInviter('')).toBe(false);
    expect(listAutoAcceptInviters()).toHaveLength(0);
  });

  it('lists every trusted inviter with its display name (UI seeding)', () => {
    addAutoAcceptInviter('actor-a', 'Ana');
    addAutoAcceptInviter('actor-b', 'Bruno');
    const list = listAutoAcceptInviters();
    expect(list).toHaveLength(2);
    // Order can tie within the same millisecond; assert membership, not order.
    const byId = new Map(list.map((e) => [e.actorId, e.name]));
    expect(byId.get('actor-a')).toBe('Ana');
    expect(byId.get('actor-b')).toBe('Bruno');
  });

  it('re-trusting the same inviter updates the name in place (no duplicate)', () => {
    addAutoAcceptInviter('actor-a', 'Ana');
    addAutoAcceptInviter('actor-a', 'Ana Paula');
    const list = listAutoAcceptInviters();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('Ana Paula');
  });

  it('a corrupt allowlist blob degrades to empty (never throws)', () => {
    localStorage.setItem('group.invite.autoaccept', '{ not json');
    expect(isAutoAcceptInviter('actor-bruno')).toBe(false);
    expect(listAutoAcceptInviters()).toEqual([]);
  });
});
