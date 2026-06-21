import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { reconnectParticipantDevice } from '@/domain/orchestrators';
import { participantRepository, peerLinkRepository } from '@/data/repositories';
import { createParticipant } from '@/domain/splitting';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { PeerLink } from '@/domain/types/peer-link';

// B2 wave 3 — reconnectParticipantDevice re-points a person to a friend's NEW
// device (fresh actorId). The hard invariant: it is LEDGER-NEUTRAL — it only
// moves the mirror delivery address (actorId), never a share/debt (those key off
// participantId). Tested against the real (fake-indexeddb) db.

function mkLink(over: Partial<PeerLink>): PeerLink {
  return {
    ...createSyncMetadata(),
    actorId: 'a',
    displayName: 'Bruno',
    participantId: null,
    lastSyncAt: null,
    publicKey: null,
    ...over,
  };
}

async function makeBruno(): Promise<string> {
  const p = { ...createParticipant('trip-1', 'Bruno', null), linkedActorId: 'old-actor' };
  await participantRepository.create(p);
  return p.id;
}

describe('reconnectParticipantDevice (B2 wave 3)', () => {
  beforeEach(async () => {
    await Promise.all([db.participants.clear(), db.peerLinks.clear()]);
  });

  it('re-points the participant to the new actor, maps the new link, retires the dead old link', async () => {
    const pid = await makeBruno();
    await peerLinkRepository.create(mkLink({ actorId: 'old-actor', participantId: pid, publicKey: null }));
    await peerLinkRepository.create(
      mkLink({ actorId: 'new-actor', participantId: null, publicKey: 'pk', lastSyncAt: new Date().toISOString() }),
    );

    const result = await reconnectParticipantDevice(pid, 'new-actor');

    expect(result?.linkedActorId).toBe('new-actor');
    expect((await participantRepository.getById(pid))?.linkedActorId).toBe('new-actor');
    // the new device's link now points to this person
    expect((await peerLinkRepository.getByActorId('new-actor'))?.participantId).toBe(pid);
    // the dead old link is retired (soft-deleted → not returned by getByActorId)
    expect(await peerLinkRepository.getByActorId('old-actor')).toBeUndefined();
  });

  it('does NOT touch any participantShare (ledger-neutral)', async () => {
    const pid = await makeBruno();
    await peerLinkRepository.create(mkLink({ actorId: 'new-actor', publicKey: 'pk' }));
    // a debt owed by Bruno, keyed by participantId — must be untouched after.
    const share = { ...createSyncMetadata(), transactionId: 'tx-1', participantId: pid, amountCents: 5000 };
    await db.participantShares.add(share as never);
    const before = await db.participantShares.toArray();

    await reconnectParticipantDevice(pid, 'new-actor');

    expect(await db.participantShares.toArray()).toEqual(before);
  });

  it('leaves the old link intact when it belongs to a DIFFERENT participant', async () => {
    const pid = await makeBruno();
    await peerLinkRepository.create(mkLink({ actorId: 'old-actor', participantId: 'someone-else', publicKey: null }));
    await peerLinkRepository.create(mkLink({ actorId: 'new-actor', publicKey: 'pk' }));

    await reconnectParticipantDevice(pid, 'new-actor');

    // not ours → never disturbed (another trip may still map to it)
    expect((await peerLinkRepository.getByActorId('old-actor'))?.participantId).toBe('someone-else');
  });

  it('returns null when the participant does not exist', async () => {
    expect(await reconnectParticipantDevice('ghost', 'new-actor')).toBeNull();
  });

  it('is a no-op when the new actor equals the current one', async () => {
    const pid = await makeBruno();
    await participantRepository.update({
      ...(await participantRepository.getById(pid))!,
      linkedActorId: 'same',
    });
    const result = await reconnectParticipantDevice(pid, 'same');
    expect(result?.linkedActorId).toBe('same');
  });
});
