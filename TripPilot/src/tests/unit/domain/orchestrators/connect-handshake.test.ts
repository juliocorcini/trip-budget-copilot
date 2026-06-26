import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { upsertPeerLinkFromConnect } from '@/domain/orchestrators';
import { peerLinkRepository } from '@/data/repositories';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { PeerLink } from '@/domain/types/peer-link';

// DEC-344 (G6) — receive side of the two-way handshake. When a drained `connect`
// envelope is folded in, the peer must appear as a reverse peerLink (so they show
// in "Conexões" and I can seal back) WITHOUT ever rewriting a ledger mapping.
// Tested against the real (fake-indexeddb) db.

const PEER = 'feedbeef-0000-4000-8000-000000000abc';

function mkLink(over: Partial<PeerLink>): PeerLink {
  return {
    ...createSyncMetadata(),
    actorId: PEER,
    displayName: 'Bruno',
    participantId: null,
    lastSyncAt: null,
    publicKey: null,
    ...over,
  };
}

describe('upsertPeerLinkFromConnect (DEC-344)', () => {
  beforeEach(async () => {
    await db.peerLinks.clear();
  });

  it('creates a fresh reverse link with the peer name + public key', async () => {
    const link = await upsertPeerLinkFromConnect({ actorId: PEER, name: 'Debora', pk: 'peer-pk' });

    expect(link.actorId).toBe(PEER);
    expect(link.displayName).toBe('Debora');
    expect(link.publicKey).toBe('peer-pk');
    expect(link.participantId).toBeNull();
    expect(link.lastSyncAt).not.toBeNull();

    const stored = await peerLinkRepository.getByActorId(PEER);
    expect(stored?.publicKey).toBe('peer-pk');
  });

  it('updates an existing link without wiping its participant mapping (ledger-neutral)', async () => {
    // A peer already mapped to a trip participant (paired earlier).
    await peerLinkRepository.create(
      mkLink({ participantId: 'participant-7', displayName: 'B.', publicKey: 'old-pk' }),
    );

    const link = await upsertPeerLinkFromConnect({ actorId: PEER, name: 'Bruno Lima', pk: 'fresh-pk' });

    // participantId is preserved (connect carries null → keep existing mapping).
    expect(link.participantId).toBe('participant-7');
    // name + key are refreshed from the announcement.
    expect(link.displayName).toBe('Bruno Lima');
    expect(link.publicKey).toBe('fresh-pk');

    // Exactly one link for this actor — upsert, not duplicate.
    const all = (await db.peerLinks.toArray()).filter((l) => l.actorId === PEER);
    expect(all).toHaveLength(1);
  });

  it('refreshes lastSyncAt on every connect (honest "last seen")', async () => {
    await peerLinkRepository.create(mkLink({ lastSyncAt: null, publicKey: 'k' }));
    const link = await upsertPeerLinkFromConnect({ actorId: PEER, name: 'Bruno', pk: 'k' });
    expect(link.lastSyncAt).not.toBeNull();
  });
});
