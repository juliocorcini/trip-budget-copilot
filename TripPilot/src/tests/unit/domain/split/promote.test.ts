import { describe, it, expect } from 'vitest';
import {
  addParticipant,
  buildSplitCommitPlan,
  createSplitItem,
  createSplitSession,
  promoteAdhocToParticipant,
  splitItemBetween,
  type SplitSession,
} from '@/domain/split';

/**
 * T5 (G3) — promoting an ad-hoc split participant to a real trip Participant.
 * The pure step re-points the SplitParticipant; the load-bearing consequence is
 * that `buildSplitCommitPlan` (→ `commitSplit` → `ParticipantShare`) then mints a
 * real debt for them, which the DEC-106 mirror propagates. These tests lock both
 * the re-point and that promote→real-debt chain.
 */

/** Owner + ad-hoc "Ana"; one €60 pizza claimed entirely by Ana. */
function sessionWithAdhocClaim(): { session: SplitSession; ownerId: string; anaId: string } {
  const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000, category: 'restaurant' });
  let session = createSplitSession({
    tripId: 't1',
    phaseId: null,
    name: 'Jantar',
    currency: 'EUR',
    ownerName: 'Eu',
    items: [pizza],
  });
  const added = addParticipant(session, 'Ana');
  session = added.session;
  const anaId = added.participant.id;
  session = splitItemBetween(session, pizza.id, [anaId]);
  const ownerId = session.participants.find((p) => p.kind === 'owner')!.id;
  return { session, ownerId, anaId };
}

describe('promoteAdhocToParticipant', () => {
  it('re-points an ad-hoc to a real trip Participant (kind:linked + id)', () => {
    const { session, anaId } = sessionWithAdhocClaim();
    const next = promoteAdhocToParticipant(session, anaId, 'real-ana');
    const ana = next.participants.find((p) => p.id === anaId)!;
    expect(ana.kind).toBe('linked');
    expect(ana.linkedParticipantId).toBe('real-ana');
  });

  it('preserves an existing actorId when none is passed (live-table guest)', () => {
    let { session, anaId } = sessionWithAdhocClaim();
    // Simulate a live-table guest: give Ana an actorId.
    session = {
      ...session,
      participants: session.participants.map((p) =>
        p.id === anaId ? { ...p, actorId: 'actor-ana' } : p,
      ),
    };
    const next = promoteAdhocToParticipant(session, anaId, 'real-ana');
    expect(next.participants.find((p) => p.id === anaId)!.actorId).toBe('actor-ana');
  });

  it('sets the actorId when provided (link the created Participant to their device)', () => {
    const { session, anaId } = sessionWithAdhocClaim();
    const next = promoteAdhocToParticipant(session, anaId, 'real-ana', { actorId: 'actor-ana' });
    expect(next.participants.find((p) => p.id === anaId)!.actorId).toBe('actor-ana');
  });

  it('never promotes the owner', () => {
    const { session, ownerId } = sessionWithAdhocClaim();
    const next = promoteAdhocToParticipant(session, ownerId, 'hijack');
    const owner = next.participants.find((p) => p.id === ownerId)!;
    expect(owner.kind).toBe('owner');
    expect(owner.linkedParticipantId).toBeNull();
  });

  it('is a no-op for an unknown participant id', () => {
    const { session } = sessionWithAdhocClaim();
    const next = promoteAdhocToParticipant(session, 'nobody', 'real-x');
    expect(next.participants).toEqual(session.participants);
  });

  it('does not touch items, claims or the other participants', () => {
    const { session, anaId } = sessionWithAdhocClaim();
    const next = promoteAdhocToParticipant(session, anaId, 'real-ana');
    expect(next.items).toEqual(session.items);
    expect(next.participants.find((p) => p.kind === 'owner')).toEqual(
      session.participants.find((p) => p.kind === 'owner'),
    );
  });

  it('promote turns a guest slice into a real debt (the commit-plan chain)', () => {
    const { session, ownerId, anaId } = sessionWithAdhocClaim();

    // Before promote: Ana is ad-hoc (unmapped) → her €60 is billed (grand total)
    // but assigned to NO ONE as a trip debt (paid by the owner's wallet only).
    const before = buildSplitCommitPlan(session, { [ownerId]: 'owner-real', [anaId]: null });
    expect(before.grandTotalCents).toBe(6000);
    expect(before.hasDebtors).toBe(false);
    expect(before.shares.some((s) => !s.isOwner && s.amountCents > 0)).toBe(false);

    // After promote: the same €60 becomes Ana's real debt.
    const promoted = promoteAdhocToParticipant(session, anaId, 'ana-real', { actorId: 'actor-ana' });
    const anaRealId = promoted.participants.find((p) => p.id === anaId)!.linkedParticipantId!;
    const after = buildSplitCommitPlan(promoted, { [ownerId]: 'owner-real', [anaId]: anaRealId });
    expect(after.hasDebtors).toBe(true);
    const anaShare = after.shares.find((s) => s.participantId === 'ana-real')!;
    expect(anaShare.amountCents).toBe(6000);
    expect(anaShare.isOwner).toBe(false);
  });
});
