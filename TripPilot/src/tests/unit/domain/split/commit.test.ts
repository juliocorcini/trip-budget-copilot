import { describe, it, expect } from 'vitest';
import {
  buildSplitCommitPlan,
  dominantSplitCategory,
  claimItemWhole,
  splitItemBetween,
  createSplitItem,
  createSplitSession,
  addParticipant,
} from '@/domain/split';
import type { SplitItem, SplitSession } from '@/domain/split';

function makeSession(
  names: string[],
  items: SplitItem[],
  overrides: Partial<SplitSession> = {},
): { session: SplitSession; ids: Record<string, string> } {
  const base = createSplitSession({
    tripId: 'trip-1',
    phaseId: null,
    name: 'Jantar',
    currency: 'BRL',
    ownerName: names[0]!,
  });
  let session: SplitSession = { ...base, items, ...overrides };
  const ids: Record<string, string> = { [names[0]!]: session.participants[0]!.id };
  for (const name of names.slice(1)) {
    const res = addParticipant(session, name);
    session = res.session;
    ids[name] = res.participant.id;
  }
  return { session, ids };
}

/** Map every participant to a real id of the same name-key (owner + listed reals). */
function realMap(ids: Record<string, string>, reals: string[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const [name, id] of Object.entries(ids)) {
    map[id] = reals.includes(name) ? `real-${name}` : null;
  }
  return map;
}

describe('dominantSplitCategory', () => {
  it('picks the category carrying the most money, ignoring other', () => {
    const session = makeSession(
      ['Eu'],
      [
        createSplitItem({ description: 'Cerveja', amountCents: 4000, category: 'bar' }),
        createSplitItem({ description: 'Prato', amountCents: 3000, category: 'restaurant' }),
        createSplitItem({ description: 'Guardanapo', amountCents: 9000, category: 'other' }),
      ],
    ).session;
    expect(dominantSplitCategory(session)).toBe('bar');
  });

  it('falls back to restaurant when every item is other/empty', () => {
    const session = makeSession(['Eu'], [createSplitItem({ description: 'X', amountCents: 100, category: 'other' })]).session;
    expect(dominantSplitCategory(session)).toBe('restaurant');
  });
});

describe('buildSplitCommitPlan', () => {
  it('itemized: owner cost is their slice; a real friend owes theirs; grand total is the whole bill', () => {
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000, category: 'restaurant' });
    const beer = createSplitItem({ description: 'Cerveja', amountCents: 2000, category: 'bar' });
    const { session, ids } = makeSession(['Eu', 'Ana'], [pizza, beer]);
    let s = claimItemWhole(session, pizza.id, ids['Eu']!);
    s = claimItemWhole(s, beer.id, ids['Ana']!);

    const plan = buildSplitCommitPlan(s, realMap(ids, ['Eu', 'Ana']));
    expect(plan.grandTotalCents).toBe(8000);
    expect(plan.ownerCostCents).toBe(6000);
    expect(plan.hasDebtors).toBe(true);
    expect(plan.category).toBe('restaurant'); // pizza 6000 > beer 2000

    const owner = plan.shares.find((x) => x.isOwner)!;
    const ana = plan.shares.find((x) => !x.isOwner)!;
    expect(owner.participantId).toBe('real-Eu');
    expect(owner.amountCents).toBe(6000);
    expect(ana.participantId).toBe('real-Ana');
    expect(ana.amountCents).toBe(2000);
  });

  it('drops ad-hoc (unmapped) people from shares but keeps the full grand total', () => {
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000 });
    const beer = createSplitItem({ description: 'Cerveja', amountCents: 2000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [pizza, beer]);
    let s = claimItemWhole(session, pizza.id, ids['Eu']!);
    s = claimItemWhole(s, beer.id, ids['Ana']!);

    // Ana stays ad-hoc (not promoted) → no share, but her 2000 is still on the bill.
    const plan = buildSplitCommitPlan(s, realMap(ids, ['Eu']));
    expect(plan.grandTotalCents).toBe(8000);
    expect(plan.ownerCostCents).toBe(6000);
    expect(plan.shares).toHaveLength(1);
    expect(plan.shares[0]!.isOwner).toBe(true);
    expect(plan.hasDebtors).toBe(false);
  });

  it('includes the service charge in the owner cost and the grand total', () => {
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000 });
    const beer = createSplitItem({ description: 'Cerveja', amountCents: 2000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [pizza, beer]);
    let s = claimItemWhole(session, pizza.id, ids['Eu']!);
    s = claimItemWhole(s, beer.id, ids['Ana']!);
    s = { ...s, serviceCharge: { mode: 'proportional', source: 'detected', amountCents: 800, percent: 10 } };

    const plan = buildSplitCommitPlan(s, realMap(ids, ['Eu', 'Ana']));
    expect(plan.grandTotalCents).toBe(8800);
    expect(plan.ownerCostCents).toBe(6600); // 6000 + 600 service
    expect(plan.shares.find((x) => !x.isOwner)!.amountCents).toBe(2200); // 2000 + 200
  });

  it('mine mode: owner bears everything, nobody owes', () => {
    const a = createSplitItem({ description: 'A', amountCents: 5000 });
    const { session, ids } = makeSession(['Eu', 'Ana'], [a], { mode: 'mine' });
    const plan = buildSplitCommitPlan(session, realMap(ids, ['Eu', 'Ana']));
    expect(plan.ownerCostCents).toBe(5000);
    expect(plan.hasDebtors).toBe(false);
  });

  it('equal mode: every real participant owes an equal slice', () => {
    const a = createSplitItem({ description: 'A', amountCents: 9000 });
    const { session, ids } = makeSession(['Eu', 'Ana', 'Beto'], [a], { mode: 'equal' });
    const plan = buildSplitCommitPlan(session, realMap(ids, ['Eu', 'Ana', 'Beto']));
    expect(plan.grandTotalCents).toBe(9000);
    expect(plan.shares.map((x) => x.amountCents).sort()).toEqual([3000, 3000, 3000]);
  });

  it('shares reconcile to the grand total when everyone is real', () => {
    const items = [
      createSplitItem({ description: 'A', amountCents: 3333 }),
      createSplitItem({ description: 'B', amountCents: 4445 }),
    ];
    const { session, ids } = makeSession(['Eu', 'Ana'], items);
    let s = claimItemWhole(session, items[0]!.id, ids['Eu']!);
    s = splitItemBetween(s, items[1]!.id, [ids['Eu']!, ids['Ana']!]);
    s = { ...s, serviceCharge: { mode: 'proportional', source: 'detected', amountCents: 778, percent: 10 } };

    const plan = buildSplitCommitPlan(s, realMap(ids, ['Eu', 'Ana']));
    const sum = plan.shares.reduce((acc, x) => acc + x.amountCents, 0);
    expect(sum).toBe(plan.grandTotalCents);
  });
});
