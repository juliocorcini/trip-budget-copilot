import { describe, it, expect } from 'vitest';
import { buildSplitFromOuting } from '@/domain/split';
import type { BuildSplitFromOutingInput, OutingRoundInput } from '@/domain/split';

// C2 (coherence §2.1): buildSplitFromOuting is the pure bridge that promotes a
// SOLO outing into a SHARED divisible bill ("dividir esta saída"). Each committed
// round becomes a claimable item; the owner is the only seeded participant; no
// persistence/transport. The MOVE (soft-delete of the source) happens later, in
// commitSplit — this builder only shapes the draft.

const BASE: Omit<BuildSplitFromOutingInput, 'rounds'> = {
  tripId: 'trip-1',
  phaseId: 'phase-1',
  name: 'Bar do Zé',
  currency: 'BRL',
  ownerName: 'Eu',
  ownerActorId: null,
};

const rounds: OutingRoundInput[] = [
  { description: 'Cerveja', amountCents: 2000, category: 'bar' },
  { description: 'Batata', amountCents: 1280, category: 'restaurant' },
];

describe('buildSplitFromOuting (C2)', () => {
  it('maps each round to a claimable item, preserving description/amount/category', () => {
    const session = buildSplitFromOuting({ ...BASE, rounds });

    expect(session.items).toHaveLength(2);
    const [beer, fries] = session.items;
    expect(beer!.description).toBe('Cerveja');
    expect(beer!.amountCents).toBe(2000);
    expect(beer!.category).toBe('bar');
    expect(fries!.description).toBe('Batata');
    expect(fries!.amountCents).toBe(1280);
    expect(fries!.category).toBe('restaurant');
    // The total claimable equals the sum of the outing rounds (nothing lost).
    expect(session.items.reduce((s, i) => s + i.amountCents, 0)).toBe(3280);
  });

  it('starts the divide with no claims and the owner as the sole participant', () => {
    const session = buildSplitFromOuting({ ...BASE, rounds });

    expect(session.items.every((i) => i.claims.length === 0)).toBe(true);
    expect(session.participants).toHaveLength(1);
    expect(session.participants[0]!.kind).toBe('owner');
    expect(session.participants[0]!.name).toBe('Eu');
    expect(session.participants[0]!.actorId).toBeNull();
    expect(session.status).toBe('draft');
  });

  it('carries the outing name and currency, defaulting the mode to itemized', () => {
    const session = buildSplitFromOuting({ ...BASE, rounds });

    expect(session.name).toBe('Bar do Zé');
    expect(session.currency).toBe('BRL');
    expect(session.mode).toBe('itemized');
    expect(session.tripId).toBe('trip-1');
    expect(session.phaseId).toBe('phase-1');
  });

  it('honors an explicit starting mode (e.g. mine)', () => {
    const session = buildSplitFromOuting({ ...BASE, rounds, mode: 'mine' });
    expect(session.mode).toBe('mine');
  });

  it('drops non-positive rounds (refunds/zeros) so only real spend is claimable', () => {
    const session = buildSplitFromOuting({
      ...BASE,
      rounds: [
        { description: 'Cerveja', amountCents: 2000, category: 'bar' },
        { description: 'Estorno', amountCents: 0, category: 'bar' },
        { description: 'Crédito', amountCents: -500, category: 'bar' },
      ],
    });

    expect(session.items).toHaveLength(1);
    expect(session.items[0]!.description).toBe('Cerveja');
  });

  it('falls back to a default name when the outing was unnamed', () => {
    const session = buildSplitFromOuting({ ...BASE, name: '   ', rounds });
    expect(session.name).toBe('Saída');
  });

  it('preserves the owner actor id when the outing user is live-linkable', () => {
    const session = buildSplitFromOuting({ ...BASE, ownerActorId: 'actor-1', rounds });
    expect(session.participants[0]!.actorId).toBe('actor-1');
  });

  it('handles an empty/all-zero outing by producing a claimable-free draft', () => {
    const session = buildSplitFromOuting({ ...BASE, rounds: [] });
    expect(session.items).toHaveLength(0);
    expect(session.participants).toHaveLength(1);
  });
});
