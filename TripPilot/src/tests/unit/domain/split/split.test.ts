import { describe, it, expect } from 'vitest';
import {
  distributeProportionally,
  distributeEqually,
  claimWeight,
  itemClaimedWeight,
  serviceChargeAmountCents,
  detectServiceCharge,
  itemsSubtotalCents,
  computeSplitTotals,
  detectUnclaimed,
  detectClaimConflicts,
  claimItem,
  claimItemWhole,
  releaseClaim,
  splitItemBetween,
  toggleEqualClaim,
  addParticipant,
  createSplitItem,
  createSplitSession,
  createAdjustment,
} from '@/domain/split';
import type { SplitItem, SplitSession } from '@/domain/split';

/* ── helpers ──────────────────────────────────────────────────────────── */

function sessionWith(overrides: Partial<SplitSession> = {}): SplitSession {
  const base = createSplitSession({
    tripId: 'trip-1',
    phaseId: null,
    name: 'Jantar',
    currency: 'BRL',
    ownerName: 'Eu',
  });
  return { ...base, ...overrides };
}

/** Build a session with named participants (owner first) and given items. */
function makeSession(
  names: string[],
  items: SplitItem[],
  overrides: Partial<SplitSession> = {},
): { session: SplitSession; ids: Record<string, string> } {
  let session = sessionWith({ items, ...overrides });
  // rename the auto-created owner to the first name
  const owner = session.participants[0]!;
  session = {
    ...session,
    participants: [{ ...owner, name: names[0]! }],
  };
  const ids: Record<string, string> = { [names[0]!]: owner.id };
  for (const name of names.slice(1)) {
    const res = addParticipant(session, name);
    session = res.session;
    ids[name] = res.participant.id;
  }
  return { session, ids };
}

const totalFor = (session: SplitSession, participantId: string): number =>
  computeSplitTotals(session).totals.find((t) => t.participantId === participantId)?.totalCents ?? 0;

/* ── distributeProportionally ─────────────────────────────────────────── */

describe('distributeProportionally', () => {
  it('splits exactly with no remainder', () => {
    expect(distributeProportionally(1000, [1, 1])).toEqual([500, 500]);
  });

  it('last positive weight absorbs the rounding remainder', () => {
    // 1000 / 3 = 333.33 → [333, 333, 334], sums to 1000
    const result = distributeProportionally(1000, [1, 1, 1]);
    expect(result).toEqual([333, 333, 334]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('weights by magnitude', () => {
    // 30/70 of 1000 = 300 / 700
    expect(distributeProportionally(1000, [3, 7])).toEqual([300, 700]);
  });

  it('skips zero-weight entries entirely', () => {
    expect(distributeProportionally(900, [1, 0, 2])).toEqual([300, 0, 600]);
  });

  it('returns all zeros when total weight is zero', () => {
    expect(distributeProportionally(1000, [0, 0])).toEqual([0, 0]);
  });

  it('handles negative totals (a discount) and still reconciles', () => {
    const result = distributeProportionally(-1000, [1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(-1000);
  });
});

/* ── distributeEqually ────────────────────────────────────────────────── */

describe('distributeEqually', () => {
  it('splits evenly when divisible', () => {
    expect(distributeEqually(900, 3)).toEqual([300, 300, 300]);
  });

  it('gives the leading parts the extra cent', () => {
    expect(distributeEqually(1000, 3)).toEqual([334, 333, 333]);
  });

  it('handles a negative total cleanly', () => {
    const result = distributeEqually(-1000, 3);
    expect(result.reduce((a, b) => a + b, 0)).toBe(-1000);
    expect(result).toEqual([-334, -333, -333]);
  });

  it('returns empty for non-positive part counts', () => {
    expect(distributeEqually(100, 0)).toEqual([]);
  });
});

/* ── claim weights ────────────────────────────────────────────────────── */

describe('claimWeight & itemClaimedWeight', () => {
  it('uses units over qty when present', () => {
    const item = createSplitItem({ description: 'Cerveja', amountCents: 3000, qty: 3 });
    expect(claimWeight(item, { participantId: 'a', fraction: 0, units: 2 })).toBeCloseTo(2 / 3);
  });

  it('falls back to fraction when units is null', () => {
    const item = createSplitItem({ description: 'Pizza', amountCents: 6000, qty: 1 });
    expect(claimWeight(item, { participantId: 'a', fraction: 0.5, units: null })).toBe(0.5);
  });

  it('sums every claim into the total claimed weight', () => {
    const item: SplitItem = {
      ...createSplitItem({ description: 'Rodízio', amountCents: 9000, qty: 1 }),
      claims: [
        { participantId: 'a', fraction: 0.5, units: null },
        { participantId: 'b', fraction: 0.5, units: null },
      ],
    };
    expect(itemClaimedWeight(item)).toBe(1);
  });
});

/* ── service charge ───────────────────────────────────────────────────── */

describe('serviceChargeAmountCents', () => {
  it('returns 0 when mode is none', () => {
    expect(serviceChargeAmountCents({ mode: 'none', source: 'manual', amountCents: 500, percent: null }, 10000)).toBe(0);
  });

  it('prefers an explicit amount', () => {
    expect(serviceChargeAmountCents({ mode: 'proportional', source: 'detected', amountCents: 1234, percent: 10 }, 10000)).toBe(1234);
  });

  it('resolves a percent against the subtotal', () => {
    expect(serviceChargeAmountCents({ mode: 'proportional', source: 'asked', amountCents: 0, percent: 10 }, 10000)).toBe(1000);
  });
});

describe('detectServiceCharge', () => {
  it('detects an explicit amount as proportional', () => {
    const res = detectServiceCharge({
      detectedAmountCents: 1500,
      detectedPercent: null,
      included: null,
      subtotalCents: 15000,
      readTotalCents: 16500,
    });
    expect(res.needsPrompt).toBe(false);
    expect(res.serviceCharge.source).toBe('detected');
    expect(res.serviceCharge.amountCents).toBe(1500);
  });

  it('resolves a detected percent into an amount', () => {
    const res = detectServiceCharge({
      detectedAmountCents: null,
      detectedPercent: 10,
      included: null,
      subtotalCents: 15000,
      readTotalCents: null,
    });
    expect(res.serviceCharge.amountCents).toBe(1500);
    expect(res.serviceCharge.percent).toBe(10);
  });

  it('infers an included service when the gap is 8-15% of items', () => {
    const res = detectServiceCharge({
      detectedAmountCents: null,
      detectedPercent: null,
      included: null,
      subtotalCents: 10000,
      readTotalCents: 11000, // 10% gap
    });
    expect(res.needsPrompt).toBe(false);
    expect(res.serviceCharge.source).toBe('inferred_included');
    expect(res.serviceCharge.amountCents).toBe(1000);
  });

  it('asks the user when nothing can be detected or inferred', () => {
    const res = detectServiceCharge({
      detectedAmountCents: null,
      detectedPercent: null,
      included: null,
      subtotalCents: 10000,
      readTotalCents: 10000, // no gap
    });
    expect(res.needsPrompt).toBe(true);
    expect(res.serviceCharge.mode).toBe('none');
  });

  it('asks when the gap is implausibly large (not a service charge)', () => {
    const res = detectServiceCharge({
      detectedAmountCents: null,
      detectedPercent: null,
      included: null,
      subtotalCents: 10000,
      readTotalCents: 15000, // 50% gap
    });
    expect(res.needsPrompt).toBe(true);
  });
});

/* ── itemized totals ──────────────────────────────────────────────────── */

describe('computeSplitTotals — itemized', () => {
  it('bills each claimed line to its claimer', () => {
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000 });
    const beer = createSplitItem({ description: 'Cerveja', amountCents: 2000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [pizza, beer]);

    let s = claimItemWhole(session, pizza.id, ids['Eu']!);
    s = claimItemWhole(s, beer.id, ids['Ana']!);

    expect(totalFor(s, ids['Eu']!)).toBe(6000);
    expect(totalFor(s, ids['Ana']!)).toBe(2000);
    expect(computeSplitTotals(s).grandTotalCents).toBe(8000);
  });

  it('splits a shared line in half exactly', () => {
    const wine = createSplitItem({ description: 'Vinho', amountCents: 9001 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [wine]);
    const s = splitItemBetween(session, wine.id, [ids['Eu']!, ids['Ana']!]);
    const totals = computeSplitTotals(s);
    const sum = totals.totals.reduce((a, t) => a + t.totalCents, 0);
    expect(sum).toBe(9001); // 4500 + 4501, reconciles
  });

  it('distributes the service charge proportionally to claimed items', () => {
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000 });
    const beer = createSplitItem({ description: 'Cerveja', amountCents: 2000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [pizza, beer]);

    let s = claimItemWhole(session, pizza.id, ids['Eu']!);
    s = claimItemWhole(s, beer.id, ids['Ana']!);
    // 10% service on 8000 = 800, split 6000:2000 → 600 / 200
    s = { ...s, serviceCharge: { mode: 'proportional', source: 'detected', amountCents: 800, percent: 10 } };

    const totals = computeSplitTotals(s);
    expect(totals.totals.find((t) => t.participantId === ids['Eu'])!.serviceCents).toBe(600);
    expect(totals.totals.find((t) => t.participantId === ids['Ana'])!.serviceCents).toBe(200);
    expect(totals.grandTotalCents).toBe(8800);
  });

  it('distributes a per-head service charge evenly', () => {
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000 });
    const beer = createSplitItem({ description: 'Cerveja', amountCents: 2000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [pizza, beer]);

    let s = claimItemWhole(session, pizza.id, ids['Eu']!);
    s = claimItemWhole(s, beer.id, ids['Ana']!);
    s = { ...s, serviceCharge: { mode: 'per_head', source: 'manual', amountCents: 1000, percent: null } };

    const totals = computeSplitTotals(s);
    expect(totals.totals.find((t) => t.participantId === ids['Eu'])!.serviceCents).toBe(500);
    expect(totals.totals.find((t) => t.participantId === ids['Ana'])!.serviceCents).toBe(500);
  });

  it('excludes orphan lines from totals and surfaces them as unclaimed', () => {
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000 });
    const dessert = createSplitItem({ description: 'Sobremesa', amountCents: 1500 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [pizza, dessert]);

    const s = claimItemWhole(session, pizza.id, ids['Eu']!);
    const totals = computeSplitTotals(s);

    expect(totals.unclaimed.map((i) => i.id)).toEqual([dessert.id]);
    expect(totals.grandTotalCents).toBe(6000); // dessert excluded
  });

  it('applies a couvert per head and a discount proportionally', () => {
    const main = createSplitItem({ description: 'Prato', amountCents: 8000 });
    const side = createSplitItem({ description: 'Acompanhamento', amountCents: 2000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [main, side]);

    let s = claimItemWhole(session, main.id, ids['Eu']!);
    s = claimItemWhole(s, side.id, ids['Ana']!);
    s = {
      ...s,
      adjustments: [
        createAdjustment({ kind: 'couvert', label: 'Couvert', amountCents: 1000 }), // per head → 500/500
        createAdjustment({ kind: 'discount', label: 'Desconto', amountCents: -1000 }), // proportional 8000:2000 → -800/-200
      ],
    };

    const me = computeSplitTotals(s).totals.find((t) => t.participantId === ids['Eu'])!;
    const ana = computeSplitTotals(s).totals.find((t) => t.participantId === ids['Ana'])!;
    expect(me.adjustmentsCents).toBe(500 - 800);
    expect(ana.adjustmentsCents).toBe(500 - 200);
    expect(computeSplitTotals(s).grandTotalCents).toBe(8000 + 2000 + 1000 - 1000);
  });
});

/* ── equal totals ─────────────────────────────────────────────────────── */

describe('computeSplitTotals — equal', () => {
  it('splits the whole bill evenly to the cent', () => {
    const a = createSplitItem({ description: 'A', amountCents: 5000 });
    const b = createSplitItem({ description: 'B', amountCents: 5001 });
    const { session } = makeSession(['Eu', 'Ana', 'Beto'], [a, b], { mode: 'equal' });
    const totals = computeSplitTotals(session);
    const sum = totals.totals.reduce((acc, t) => acc + t.totalCents, 0);
    expect(sum).toBe(10001);
    // 10001 / 3 = 3334, 3334, 3333
    expect(totals.totals.map((t) => t.totalCents).sort((x, y) => y - x)).toEqual([3334, 3334, 3333]);
  });

  it('includes service and adjustments in the equal split', () => {
    const a = createSplitItem({ description: 'A', amountCents: 9000 });
    const { session } = makeSession(['Eu', 'Ana', 'Beto'], [a], {
      mode: 'equal',
      serviceCharge: { mode: 'proportional', source: 'detected', amountCents: 900, percent: 10 },
    });
    const totals = computeSplitTotals(session);
    expect(totals.grandTotalCents).toBe(9900);
    expect(totals.totals.every((t) => t.totalCents === 3300)).toBe(true);
  });
});

/* ── mine totals ──────────────────────────────────────────────────────── */

describe('computeSplitTotals — mine', () => {
  it('assigns the entire bill to the owner', () => {
    const a = createSplitItem({ description: 'A', amountCents: 5000 });
    const b = createSplitItem({ description: 'B', amountCents: 2500 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [a, b], {
      mode: 'mine',
      serviceCharge: { mode: 'proportional', source: 'detected', amountCents: 750, percent: 10 },
    });
    const totals = computeSplitTotals(session);
    expect(totals.ownerTotal?.participantId).toBe(ids['Eu']);
    expect(totals.ownerTotal?.totalCents).toBe(8250);
    expect(totalFor(session, ids['Ana']!)).toBe(0);
  });
});

/* ── claim mutations ──────────────────────────────────────────────────── */

describe('claimItem / releaseClaim', () => {
  it('replaces a prior claim by the same participant', () => {
    const item = createSplitItem({ description: 'X', amountCents: 1000, qty: 4 });
    const { session, ids } = makeSession(['Eu'], [item]);
    let s = claimItem(session, item.id, ids['Eu']!, { units: 1 });
    s = claimItem(s, item.id, ids['Eu']!, { units: 3 });
    expect(s.items[0]!.claims).toHaveLength(1);
    expect(s.items[0]!.claims[0]!.units).toBe(3);
  });

  it('releases a claim', () => {
    const item = createSplitItem({ description: 'X', amountCents: 1000 });
    const { session, ids } = makeSession(['Eu'], [item]);
    let s = claimItemWhole(session, item.id, ids['Eu']!);
    s = releaseClaim(s, item.id, ids['Eu']!);
    expect(s.items[0]!.claims).toHaveLength(0);
  });

  it('is a no-op once a participant is marked paid (E10 lock)', () => {
    const item = createSplitItem({ description: 'X', amountCents: 1000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [item]);
    let s = claimItemWhole(session, item.id, ids['Ana']!);
    s = {
      ...s,
      participants: s.participants.map((p) =>
        p.id === ids['Ana'] ? { ...p, markedPaid: true } : p,
      ),
    };
    const after = releaseClaim(s, item.id, ids['Ana']!);
    expect(after.items[0]!.claims).toHaveLength(1); // unchanged
  });

  it('does not mutate the original session (immutability)', () => {
    const item = createSplitItem({ description: 'X', amountCents: 1000 });
    const { session, ids } = makeSession(['Eu'], [item]);
    claimItemWhole(session, item.id, ids['Eu']!);
    expect(session.items[0]!.claims).toHaveLength(0);
  });
});

/* ── participant dedup ────────────────────────────────────────────────── */

describe('addParticipant', () => {
  it('appends a new ad-hoc participant', () => {
    const { session } = makeSession(['Eu'], []);
    const res = addParticipant(session, 'Ana');
    expect(res.session.participants).toHaveLength(2);
    expect(res.participant.kind).toBe('adhoc');
  });

  it('re-links a returning device by actorId instead of duplicating (E7)', () => {
    const { session } = makeSession(['Eu'], []);
    const first = addParticipant(session, 'Ana', { actorId: 'actor-1' });
    const second = addParticipant(first.session, 'Ana again', { actorId: 'actor-1' });
    expect(second.session.participants).toHaveLength(2); // owner + Ana, no dupe
    expect(second.participant.id).toBe(first.participant.id);
  });

  it('defaults a blank name to a guest label', () => {
    const { session } = makeSession(['Eu'], []);
    const res = addParticipant(session, '   ');
    expect(res.participant.name).toBe('Convidado');
  });
});

/* ── conflicts & unclaimed ────────────────────────────────────────────── */

describe('detectClaimConflicts & detectUnclaimed', () => {
  it('flags a qty-1 line claimed whole by two people', () => {
    const item = createSplitItem({ description: 'Combo', amountCents: 5000, qty: 1 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [item]);
    let s = claimItemWhole(session, item.id, ids['Eu']!);
    s = claimItemWhole(s, item.id, ids['Ana']!);
    const conflicts = detectClaimConflicts(s);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.itemId).toBe(item.id);
  });

  it('does not flag a clean half/half split', () => {
    const item = createSplitItem({ description: 'Combo', amountCents: 5000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [item]);
    const s = splitItemBetween(session, item.id, [ids['Eu']!, ids['Ana']!]);
    expect(detectClaimConflicts(s)).toHaveLength(0);
  });

  it('lists items nobody claimed', () => {
    const a = createSplitItem({ description: 'A', amountCents: 1000 });
    const b = createSplitItem({ description: 'B', amountCents: 2000 });
    const { session, ids } = makeSession(['Eu'], [a, b]);
    const s = claimItemWhole(session, a.id, ids['Eu']!);
    expect(detectUnclaimed(s).map((i) => i.id)).toEqual([b.id]);
  });
});

/* ── toggleEqualClaim (deselect bug F1) ───────────────────────────────── */

describe('toggleEqualClaim', () => {
  it('adds a claim on the first tap (orphan → mine)', () => {
    const item = createSplitItem({ description: 'Cerveja', amountCents: 1000 });
    const { session, ids } = makeSession(['Eu'], [item]);
    const s = toggleEqualClaim(session, item.id, ids['Eu']!);
    expect(s.items[0]!.claims.map((c) => c.participantId)).toEqual([ids['Eu']!]);
  });

  it('releases the SOLE claimer on the second tap (the F1 regression)', () => {
    // Before the fix this was impossible: the toggle passed [] to
    // splitItemBetween (a no-op), so the only claimer could never deselect.
    const item = createSplitItem({ description: 'Cerveja', amountCents: 1000 });
    const { session, ids } = makeSession(['Eu'], [item]);
    const claimed = toggleEqualClaim(session, item.id, ids['Eu']!);
    const released = toggleEqualClaim(claimed, item.id, ids['Eu']!);
    expect(released.items[0]!.claims).toEqual([]);
    expect(detectUnclaimed(released).map((i) => i.id)).toEqual([item.id]);
  });

  it('removing one of two claimers re-splits the line to the remaining person (whole)', () => {
    const item = createSplitItem({ description: 'Combo', amountCents: 5000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [item]);
    let s = toggleEqualClaim(session, item.id, ids['Eu']!); // Eu: whole
    s = toggleEqualClaim(s, item.id, ids['Ana']!); // Eu+Ana: ½ each
    s = toggleEqualClaim(s, item.id, ids['Eu']!); // Eu out → Ana whole
    expect(s.items[0]!.claims.map((c) => c.participantId)).toEqual([ids['Ana']!]);
    expect(totalFor(s, ids['Ana']!)).toBe(5000);
    expect(totalFor(s, ids['Eu']!)).toBe(0);
  });

  it('is a no-op for an unknown item id', () => {
    const item = createSplitItem({ description: 'X', amountCents: 100 });
    const { session, ids } = makeSession(['Eu'], [item]);
    expect(toggleEqualClaim(session, 'nope', ids['Eu']!)).toBe(session);
  });
});

/* ── reconciliation invariant ─────────────────────────────────────────── */

describe('reconciliation invariant', () => {
  it('grand total equals billed items + service + adjustments (itemized, all claimed)', () => {
    const items = [
      createSplitItem({ description: 'A', amountCents: 3333 }),
      createSplitItem({ description: 'B', amountCents: 4444 }),
      createSplitItem({ description: 'C', amountCents: 5555 }),
    ];
    const { session, ids } = makeSession(['Eu', 'Ana', 'Beto'], items);
    let s = claimItemWhole(session, items[0]!.id, ids['Eu']!);
    s = claimItemWhole(s, items[1]!.id, ids['Ana']!);
    s = splitItemBetween(s, items[2]!.id, [ids['Eu']!, ids['Ana']!, ids['Beto']!]);
    s = {
      ...s,
      serviceCharge: { mode: 'proportional', source: 'detected', amountCents: 1333, percent: 10 },
      adjustments: [createAdjustment({ kind: 'couvert', label: 'Couvert', amountCents: 900 })],
    };

    const subtotal = itemsSubtotalCents(s);
    const expected = subtotal + 1333 + 900;
    expect(computeSplitTotals(s).grandTotalCents).toBe(expected);
  });
});
