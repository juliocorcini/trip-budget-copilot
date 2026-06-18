import { describe, it, expect } from 'vitest';
import {
  buildSplitClaimResponse,
  parseSplitClaimResponse,
  reduceGuestClaims,
  computeSplitTotals,
  createSplitSession,
  createSplitItem,
  claimItemWhole,
  itemClaimedWeight,
} from '@/domain/split';
import type { SplitClaimResponse, SplitSession } from '@/domain/split';

/** Two-item EUR dinner; the owner may carry an actorId (spoofing test). */
function makeSession(ownerActorId: string | null = null): SplitSession {
  return createSplitSession({
    tripId: null,
    phaseId: null,
    name: 'Jantar',
    currency: 'EUR',
    ownerName: 'Eu',
    ownerActorId,
    items: [
      createSplitItem({ description: 'Pizza', amountCents: 2000 }),
      createSplitItem({ description: 'Suco', amountCents: 1000 }),
    ],
  });
}

function snapshot(
  fromActorId: string,
  fromName: string,
  itemIds: string[],
  at: string,
): SplitClaimResponse {
  return {
    v: 1,
    fromActorId,
    fromName,
    claims: itemIds.map((itemId) => ({ itemId, fraction: 1, units: null })),
    at,
  };
}

describe('split claim response — build/parse', () => {
  it('builds a snapshot, trimming the name and defaulting an empty one', () => {
    const built = buildSplitClaimResponse({
      fromActorId: 'g1',
      fromName: '  Bia  ',
      claims: [{ itemId: 'i1', fraction: 0.5, units: null }],
    });
    expect(built.v).toBe(1);
    expect(built.fromName).toBe('Bia');
    expect(built.claims).toHaveLength(1);
    expect(buildSplitClaimResponse({ fromActorId: 'g1', fromName: '   ', claims: [] }).fromName).toBe(
      'Convidado',
    );
  });

  it('round-trips through JSON and rejects garbage / out-of-range fractions', () => {
    const built = buildSplitClaimResponse({
      fromActorId: 'g1',
      fromName: 'Bia',
      claims: [{ itemId: 'i1', fraction: 1, units: null }],
    });
    expect(parseSplitClaimResponse(JSON.parse(JSON.stringify(built)))).not.toBeNull();
    expect(parseSplitClaimResponse(null)).toBeNull();
    expect(parseSplitClaimResponse({ v: 1, fromActorId: 'g', fromName: 'B', claims: [{ itemId: 'i', fraction: 2, units: null }], at: 'x' })).toBeNull();
  });
});

describe('reduceGuestClaims — owner-authoritative live merge', () => {
  it('adds a new guest (ad-hoc, linked by actorId) and applies their claim', () => {
    const base = makeSession();
    const pizza = base.items[0]!;
    const next = reduceGuestClaims(base, [snapshot('g1', 'Bia', [pizza.id], '2026-06-18T10:00:00Z')]);

    expect(next.participants).toHaveLength(2);
    const bia = next.participants.find((p) => p.actorId === 'g1')!;
    expect(bia.kind).toBe('adhoc');
    expect(itemClaimedWeight(next.items[0]!)).toBe(1);

    const totals = computeSplitTotals(next);
    expect(totals.totals.find((t) => t.participantId === bia.id)!.totalCents).toBe(2000);
    expect(totals.unclaimed.map((i) => i.description)).toEqual(['Suco']);
  });

  it('merges two guests claiming different lines; the third line stays an orphan', () => {
    const base = makeSession();
    const [pizza, suco] = [base.items[0]!, base.items[1]!];
    const next = reduceGuestClaims(base, [
      snapshot('g1', 'Bia', [pizza.id], '2026-06-18T10:00:00Z'),
      snapshot('g2', 'Caio', [suco.id], '2026-06-18T10:00:01Z'),
    ]);
    expect(next.participants).toHaveLength(3);
    expect(computeSplitTotals(next).unclaimed).toHaveLength(0);
  });

  it('keeps only the latest snapshot per guest (re-selection releases the old line)', () => {
    const base = makeSession();
    const [pizza, suco] = [base.items[0]!, base.items[1]!];
    const next = reduceGuestClaims(base, [
      snapshot('g1', 'Bia', [pizza.id], '2026-06-18T10:00:00Z'),
      snapshot('g1', 'Bia', [suco.id], '2026-06-18T10:00:05Z'),
    ]);
    const bia = next.participants.find((p) => p.actorId === 'g1')!;
    expect(next.items[0]!.claims).toHaveLength(0); // pizza released
    expect(next.items[1]!.claims.map((c) => c.participantId)).toEqual([bia.id]); // suco claimed
  });

  it('an empty snapshot releases everything but keeps the guest at the table', () => {
    const base = makeSession();
    const pizza = base.items[0]!;
    const next = reduceGuestClaims(base, [
      snapshot('g1', 'Bia', [pizza.id], '2026-06-18T10:00:00Z'),
      snapshot('g1', 'Bia', [], '2026-06-18T10:00:09Z'),
    ]);
    expect(next.participants.some((p) => p.actorId === 'g1')).toBe(true);
    expect(itemClaimedWeight(next.items[0]!)).toBe(0); // orphan again
  });

  it('does not duplicate a returning guest (same actorId re-links)', () => {
    const base = makeSession();
    const pizza = base.items[0]!;
    const next = reduceGuestClaims(base, [
      snapshot('g1', 'Bia', [pizza.id], '2026-06-18T10:00:00Z'),
      snapshot('g1', 'Bia', [pizza.id], '2026-06-18T10:00:02Z'),
    ]);
    expect(next.participants.filter((p) => p.actorId === 'g1')).toHaveLength(1);
  });

  it('never lets a guest rewrite the owner slice by spoofing the owner actorId', () => {
    const base = makeSession('owner-actor');
    const pizza = base.items[0]!;
    const next = reduceGuestClaims(base, [snapshot('owner-actor', 'Hacker', [pizza.id], '2026-06-18T10:00:00Z')]);
    expect(next.participants).toHaveLength(1); // no new participant; owner untouched
    expect(itemClaimedWeight(next.items[0]!)).toBe(0); // owner gained no claim
  });

  it('freezes a markedPaid guest (E10): their later snapshot is ignored', () => {
    const base = makeSession();
    const [pizza, suco] = [base.items[0]!, base.items[1]!];
    const afterClaim = reduceGuestClaims(base, [snapshot('g1', 'Bia', [pizza.id], '2026-06-18T10:00:00Z')]);
    const bia = afterClaim.participants.find((p) => p.actorId === 'g1')!;
    const locked: SplitSession = {
      ...afterClaim,
      participants: afterClaim.participants.map((p) => (p.id === bia.id ? { ...p, markedPaid: true } : p)),
    };
    const next = reduceGuestClaims(locked, [snapshot('g1', 'Bia', [suco.id], '2026-06-18T10:09:00Z')]);
    expect(next.items[0]!.claims.map((c) => c.participantId)).toEqual([bia.id]); // pizza still theirs
    expect(itemClaimedWeight(next.items[1]!)).toBe(0); // suco NOT taken
  });

  it('ignores a claim on an unknown item id without crashing', () => {
    const base = makeSession();
    const next = reduceGuestClaims(base, [snapshot('g1', 'Bia', ['does-not-exist'], '2026-06-18T10:00:00Z')]);
    expect(next.participants.some((p) => p.actorId === 'g1')).toBe(true);
    expect(next.items.every((i) => i.claims.length === 0)).toBe(true);
  });

  it('preserves the owner’s own claims while merging a guest', () => {
    const base = makeSession();
    const [pizza, suco] = [base.items[0]!, base.items[1]!];
    const owner = base.participants[0]!;
    const withOwnerClaim = claimItemWhole(base, suco.id, owner.id); // owner took the juice
    const next = reduceGuestClaims(withOwnerClaim, [snapshot('g1', 'Bia', [pizza.id], '2026-06-18T10:00:00Z')]);
    expect(next.items[1]!.claims.map((c) => c.participantId)).toEqual([owner.id]); // owner kept
    const totals = computeSplitTotals(next);
    expect(totals.unclaimed).toHaveLength(0);
    expect(totals.ownerTotal!.totalCents).toBe(1000);
  });
});
