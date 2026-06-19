import { describe, it, expect } from 'vitest';
import {
  buildSplitHistory,
  splitClaimChannel,
  createSplitSession,
  createSplitItem,
  claimItemWhole,
  splitItemBetween,
  addParticipant,
  computeSplitTotals,
} from '@/domain/split';
import type { SplitParticipant, SplitSession } from '@/domain/split';

/** A 3-item EUR dinner owned by "Eu". */
function makeSession(): SplitSession {
  return createSplitSession({
    tripId: null,
    phaseId: null,
    name: 'Jantar',
    currency: 'EUR',
    ownerName: 'Eu',
    items: [
      createSplitItem({ description: 'Pizza', amountCents: 2000 }),
      createSplitItem({ description: 'Suco', amountCents: 1000 }),
      createSplitItem({ description: 'Sobremesa', amountCents: 600 }),
    ],
  });
}

function part(session: SplitSession, name: string): SplitParticipant {
  return session.participants.find((p) => p.name === name)!;
}

describe('splitClaimChannel — how each person joined the table', () => {
  it('maps kind + actorId to the right channel', () => {
    expect(splitClaimChannel({ kind: 'owner', actorId: null } as SplitParticipant)).toBe('owner');
    // ad-hoc with a device = a guest who claimed via the shared link, no account.
    expect(splitClaimChannel({ kind: 'adhoc', actorId: 'dev-1' } as SplitParticipant)).toBe('guest_link');
    // ad-hoc without a device = a name the owner typed at the table.
    expect(splitClaimChannel({ kind: 'adhoc', actorId: null } as SplitParticipant)).toBe('manual');
    // linked + device = a companion using their own app.
    expect(splitClaimChannel({ kind: 'linked', actorId: 'dev-2' } as SplitParticipant)).toBe('app_linked');
    // linked without a device = a trip companion the owner added.
    expect(splitClaimChannel({ kind: 'linked', actorId: null } as SplitParticipant)).toBe('companion');
  });
});

describe('buildSplitHistory — itemized', () => {
  it('attributes each line to its claimer with the per-person slice, and reconciles to totals', () => {
    let session = makeSession();
    // A guest from the live link (ad-hoc + actorId).
    const added = addParticipant(session, 'Bia', { kind: 'adhoc', actorId: 'dev-bia' });
    session = added.session;
    const owner = part(session, 'Eu');
    const bia = part(session, 'Bia');

    // Owner takes the pizza alone; pizza+? — actually: owner=Pizza, Bia=Suco, shared Sobremesa.
    const [pizza, suco, dessert] = session.items;
    session = claimItemWhole(session, pizza!.id, owner.id);
    session = claimItemWhole(session, suco!.id, bia.id);
    session = splitItemBetween(session, dessert!.id, [owner.id, bia.id]);

    const history = buildSplitHistory(session, { ownerName: 'Eu' });
    const totals = computeSplitTotals(session);

    // Reconciles to the authoritative grand total (2000 + 1000 + 600).
    expect(history.grandTotalCents).toBe(3600);
    expect(history.grandTotalCents).toBe(totals.grandTotalCents);

    // Owner is always first.
    expect(history.entries[0]!.isOwner).toBe(true);

    const ownerEntry = history.entries.find((e) => e.isOwner)!;
    const biaEntry = history.entries.find((e) => !e.isOwner)!;

    // Owner: pizza (2000) + half dessert (300) = 2300.
    expect(ownerEntry.totalCents).toBe(2300);
    expect(ownerEntry.channel).toBe('owner');
    expect(ownerEntry.lines.map((l) => l.description).sort()).toEqual(['Pizza', 'Sobremesa']);
    const ownerDessert = ownerEntry.lines.find((l) => l.description === 'Sobremesa')!;
    expect(ownerDessert.amountCents).toBe(300);
    expect(ownerDessert.sharedCount).toBe(2);

    // Bia: suco (1000) + half dessert (300) = 1300, joined via the link.
    expect(biaEntry.totalCents).toBe(1300);
    expect(biaEntry.channel).toBe('guest_link');
    const biaPizza = biaEntry.lines.find((l) => l.description === 'Pizza');
    expect(biaPizza).toBeUndefined();

    // Per-person line sums equal the entry's itemsCents.
    for (const entry of history.entries) {
      const lineSum = entry.lines.reduce((s, l) => s + l.amountCents, 0);
      expect(lineSum).toBe(entry.itemsCents);
    }
  });

  it('surfaces unclaimed lines (the orphans the owner absorbs)', () => {
    let session = makeSession();
    const owner = part(session, 'Eu');
    const [pizza] = session.items;
    session = claimItemWhole(session, pizza!.id, owner.id);

    const history = buildSplitHistory(session, { ownerName: 'Eu' });
    // Suco + Sobremesa were never claimed.
    expect(history.unclaimed.map((u) => u.description).sort()).toEqual(['Sobremesa', 'Suco']);
  });
});

describe('buildSplitHistory — item-first view (esse item foi pra quem)', () => {
  it('attributes every line to its takers and reconciles each line to the cent', () => {
    let session = makeSession();
    const added = addParticipant(session, 'Bia', { kind: 'adhoc', actorId: 'dev-bia' });
    session = added.session;
    const owner = part(session, 'Eu');
    const bia = part(session, 'Bia');
    const [pizza, suco, dessert] = session.items;
    session = claimItemWhole(session, pizza!.id, owner.id);
    session = claimItemWhole(session, suco!.id, bia.id);
    session = splitItemBetween(session, dessert!.id, [owner.id, bia.id]);

    const history = buildSplitHistory(session, { ownerName: 'Eu' });
    expect(history.items).toHaveLength(3);

    const pizzaItem = history.items.find((i) => i.description === 'Pizza')!;
    expect(pizzaItem.claimed).toBe(true);
    expect(pizzaItem.takers).toHaveLength(1);
    expect(pizzaItem.takers[0]!.isOwner).toBe(true);
    expect(pizzaItem.takers[0]!.shareCents).toBe(2000);
    expect(pizzaItem.takers[0]!.weight).toBeCloseTo(1);

    const sucoItem = history.items.find((i) => i.description === 'Suco')!;
    expect(sucoItem.takers[0]!.channel).toBe('guest_link');
    expect(sucoItem.takers[0]!.shareCents).toBe(1000);

    const dessertItem = history.items.find((i) => i.description === 'Sobremesa')!;
    expect(dessertItem.takers).toHaveLength(2);
    expect(dessertItem.takers.every((tk) => tk.shareCents === 300)).toBe(true);
    expect(dessertItem.takers.every((tk) => tk.weight === 0.5)).toBe(true);

    // Every line's taker shares sum to what was billed for that line.
    for (const item of history.items) {
      const sum = item.takers.reduce((s, tk) => s + tk.shareCents, 0);
      expect(sum).toBe(item.billedCents);
    }
    // And the billed lines reconcile to the grand total.
    expect(history.items.reduce((s, i) => s + i.billedCents, 0)).toBe(3600);
  });

  it('flags an orphan line as not-claimed with no takers', () => {
    let session = makeSession();
    const owner = part(session, 'Eu');
    const [pizza] = session.items;
    session = claimItemWhole(session, pizza!.id, owner.id);

    const history = buildSplitHistory(session, { ownerName: 'Eu' });
    const suco = history.items.find((i) => i.description === 'Suco')!;
    expect(suco.claimed).toBe(false);
    expect(suco.takers).toHaveLength(0);
    expect(suco.billedCents).toBe(0);
  });

  it('equal mode puts the whole table on every line', () => {
    let session = makeSession();
    const added = addParticipant(session, 'Léo', { kind: 'linked', actorId: null });
    session = { ...added.session, mode: 'equal' };

    const history = buildSplitHistory(session, { ownerName: 'Eu' });
    const pizza = history.items.find((i) => i.description === 'Pizza')!;
    expect(pizza.takers).toHaveLength(2);
    expect(pizza.takers.reduce((s, tk) => s + tk.shareCents, 0)).toBe(2000);
    expect(pizza.takers.every((tk) => tk.shareCents === 1000)).toBe(true);
  });

  it('mine mode attributes every line to the owner', () => {
    const session = { ...makeSession(), mode: 'mine' as const };
    const history = buildSplitHistory(session, { ownerName: 'Eu' });
    for (const item of history.items) {
      expect(item.takers).toHaveLength(1);
      expect(item.takers[0]!.isOwner).toBe(true);
      expect(item.takers[0]!.shareCents).toBe(item.amountCents);
    }
  });
});

describe('buildSplitHistory — service charge + equal mode', () => {
  it('includes each person service share and keeps the grand total whole', () => {
    let session = makeSession();
    const added = addParticipant(session, 'Léo', { kind: 'linked', actorId: null });
    session = added.session;
    session = { ...session, mode: 'equal', serviceCharge: { mode: 'proportional', source: 'manual', amountCents: 360, percent: 10 } };

    const history = buildSplitHistory(session, { ownerName: 'Eu' });
    const totals = computeSplitTotals(session);

    // 3600 items + 360 service = 3960, split equally across 2 people.
    expect(history.grandTotalCents).toBe(3960);
    expect(history.grandTotalCents).toBe(totals.grandTotalCents);

    const leo = history.entries.find((e) => !e.isOwner)!;
    expect(leo.channel).toBe('companion');
    expect(leo.serviceCents).toBeGreaterThan(0);
    // Equal mode has no per-item lines.
    expect(leo.lines).toHaveLength(0);
  });
});
