import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { removePerson } from '@/domain/orchestrators';
import { isParticipantSettled } from '@/domain/splitting';
import type { DebtEntry } from '@/domain/splitting';
import { participantRepository, peerLinkRepository, participantShareRepository } from '@/data/repositories';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { Participant } from '@/domain/types/participant';
import type { PeerLink } from '@/domain/types/peer-link';
import type { ParticipantShare } from '@/domain/types/participant-share';

// DEC-418 (G7 · Â-PERSON-HIDE-NEVER-BREAK) — removing a person for good soft-deletes
// the participant for ANY status (severing any live link first), never the owner,
// and preserves history. The UI's balance=0 guard is the pure `isParticipantSettled`.
// Tested against the real (fake-indexeddb) db.

const TRIP = 'trip-g7';

function mkParticipant(over: Partial<Participant> & { id: string }): Participant {
  return {
    ...createSyncMetadata(),
    tripId: TRIP,
    name: 'Person',
    nickname: null,
    isOwner: false,
    email: null,
    linkedUserAccountId: null,
    linkedActorId: null,
    ...over,
  };
}

function mkShare(over: Partial<ParticipantShare> & { id: string; participantId: string }): ParticipantShare {
  return {
    ...createSyncMetadata(),
    transactionId: 'tx-1',
    shareAmountCents: 1000,
    shareType: 'equal',
    isPaid: false,
    confirmationStatus: 'confirmed',
    notes: null,
    ...over,
  };
}

function mkLink(over: Partial<PeerLink> & { actorId: string }): PeerLink {
  return {
    ...createSyncMetadata(),
    displayName: 'Bruno',
    participantId: null,
    lastSyncAt: null,
    publicKey: null,
    ...over,
  };
}

describe('removePerson (DEC-418)', () => {
  beforeEach(async () => {
    await Promise.all([db.participants.clear(), db.peerLinks.clear(), db.participantShares.clear()]);
  });

  it('soft-deletes a plain typed name so it leaves every list', async () => {
    await participantRepository.create(mkParticipant({ id: 'debora', name: 'Débora' }));

    const result = await removePerson('debora');

    expect(result.removed).toBe(true);
    // Gone from the live list (repos filter deletedAt), but the row survives (history).
    expect(await participantRepository.getById('debora')).toBeUndefined();
    const raw = await db.participants.get('debora');
    expect(raw?.deletedAt).not.toBeNull();
  });

  it('never removes the owner', async () => {
    await participantRepository.create(mkParticipant({ id: 'owner', name: 'Julio', isOwner: true }));

    const result = await removePerson('owner');

    expect(result.removed).toBe(false);
    expect(await participantRepository.getById('owner')).toBeDefined();
  });

  it('severs a live connection (tombstones the peer link) AND hides the participant', async () => {
    await participantRepository.create(
      mkParticipant({ id: 'bruno', name: 'Bruno', linkedActorId: 'actor-b' }),
    );
    await peerLinkRepository.create(
      mkLink({ actorId: 'actor-b', participantId: 'bruno', publicKey: 'pk-b' }),
    );

    const result = await removePerson('bruno');

    expect(result.removed).toBe(true);
    expect(result.tombstoned).toBeGreaterThanOrEqual(1);
    expect(await participantRepository.getById('bruno')).toBeUndefined();
    // The peer link is tombstoned → no longer live.
    expect(await peerLinkRepository.getByActorId('actor-b')).toBeUndefined();
  });

  it('preserves history — the removed person keeps their past shares intact', async () => {
    await participantRepository.create(mkParticipant({ id: 'debora', name: 'Débora' }));
    await participantShareRepository.create(mkShare({ id: 's-1', participantId: 'debora' }));

    await removePerson('debora');

    const share = await db.participantShares.get('s-1');
    expect(share?.deletedAt).toBeNull(); // the share (and its captured attribution) survives
  });
});

describe('isParticipantSettled (DEC-418 — balance=0 guard, DEC-474 per currency)', () => {
  const noDebts: DebtEntry[] = [];
  const mkDebt = (debtorId: string, creditorId: string, amountCents: number): DebtEntry => ({
    debtorId, debtorName: debtorId, creditorId, creditorName: creditorId, amountCents, currency: 'EUR',
  });
  const buckets = (id: string, entries: [string, number][]) =>
    new Map([[id, entries.map(([currency, amountCents]) => ({ currency, amountCents }))]]);

  it('is TRUE when the owner-pairwise net is 0 and no debt edge touches them', () => {
    expect(isParticipantSettled('debora', buckets('debora', []), noDebts)).toBe(true);
    expect(isParticipantSettled('debora', new Map(), noDebts)).toBe(true); // absent → 0
  });

  it('is FALSE when they still owe / are owed by the owner', () => {
    expect(isParticipantSettled('debora', buckets('debora', [['EUR', -1200]]), noDebts)).toBe(false);
    expect(isParticipantSettled('debora', buckets('debora', [['EUR', 800]]), noDebts)).toBe(false);
  });

  it('is FALSE when ANY currency bucket is still open (DEC-474 — a BRL debt blocks removal)', () => {
    expect(
      isParticipantSettled('debora', buckets('debora', [['EUR', 0], ['BRL', -38000]]), noDebts),
    ).toBe(false);
  });

  it('is FALSE when a third-party debt still involves them (never orphan it)', () => {
    const debts = [mkDebt('debora', 'bruno', 5000)]; // Débora owes Bruno — owner not involved
    expect(isParticipantSettled('debora', buckets('debora', []), debts)).toBe(false);
    expect(isParticipantSettled('bruno', buckets('bruno', []), debts)).toBe(false);
  });

  it('ignores zero-amount edges (fully settled)', () => {
    const debts = [mkDebt('debora', 'bruno', 0)];
    expect(isParticipantSettled('debora', buckets('debora', []), debts)).toBe(true);
  });
});
