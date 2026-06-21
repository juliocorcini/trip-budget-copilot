import { describe, it, expect } from 'vitest';
import {
  CONNECTION_FRESH_WINDOW_MS,
  deriveConnectionStatus,
  toConnectionView,
  buildConnectionViews,
  findReconnectCandidate,
} from '@/domain/connections';
import type { PeerLink } from '@/domain/types/peer-link';

// B2 (coherence §2.2): the pure "Amigos/Conexões" read layer over the existing
// global peerLinks registry. Honest state is the council's hard requirement —
// these tests pin the truth about whether a peer is reachable right now.

const NOW = Date.parse('2026-06-21T12:00:00.000Z');

function link(over: Partial<PeerLink> = {}): PeerLink {
  return {
    id: over.id ?? 'l1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 0,
    sourceDeviceId: 'device-1',
    actorId: over.actorId ?? 'actor-1',
    displayName: over.displayName ?? 'Bruno',
    participantId: over.participantId ?? null,
    lastSyncAt: over.lastSyncAt ?? null,
    publicKey: over.publicKey ?? null,
    ...over,
  };
}

const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe('deriveConnectionStatus (B2)', () => {
  it('offline when there is no public key (cannot seal async — must re-pair)', () => {
    expect(deriveConnectionStatus(link({ publicKey: null, lastSyncAt: daysAgo(0) }), NOW)).toBe('offline');
  });

  it('connected when keyed and synced within the fresh window', () => {
    expect(deriveConnectionStatus(link({ publicKey: 'pk', lastSyncAt: daysAgo(3) }), NOW)).toBe('connected');
  });

  it('waiting when keyed but the sync is stale (beyond the window)', () => {
    expect(deriveConnectionStatus(link({ publicKey: 'pk', lastSyncAt: daysAgo(30) }), NOW)).toBe('waiting');
  });

  it('waiting when keyed but never synced', () => {
    expect(deriveConnectionStatus(link({ publicKey: 'pk', lastSyncAt: null }), NOW)).toBe('waiting');
  });

  it('treats the exact window boundary as still connected', () => {
    const onEdge = new Date(NOW - CONNECTION_FRESH_WINDOW_MS).toISOString();
    expect(deriveConnectionStatus(link({ publicKey: 'pk', lastSyncAt: onEdge }), NOW)).toBe('connected');
  });

  it('waiting on an unparseable timestamp (never lies "connected")', () => {
    expect(deriveConnectionStatus(link({ publicKey: 'pk', lastSyncAt: 'not-a-date' }), NOW)).toBe('waiting');
  });
});

describe('toConnectionView (B2)', () => {
  it('carries actor/name/participant and reports canDeliver from the key', () => {
    const view = toConnectionView(link({ actorId: 'a9', displayName: 'Ana', participantId: 'p3', publicKey: 'pk', lastSyncAt: daysAgo(1) }), NOW);
    expect(view).toMatchObject({
      actorId: 'a9',
      displayName: 'Ana',
      participantId: 'p3',
      canDeliver: true,
      status: 'connected',
    });
  });

  it('canDeliver is false without a key', () => {
    expect(toConnectionView(link({ publicKey: null }), NOW).canDeliver).toBe(false);
  });
});

describe('buildConnectionViews (B2)', () => {
  it('orders connected → waiting → offline, then by recency, then by name', () => {
    const views = buildConnectionViews(
      [
        link({ id: '1', actorId: 'off', displayName: 'Zed', publicKey: null }),
        link({ id: '2', actorId: 'wait', displayName: 'Caio', publicKey: 'pk', lastSyncAt: daysAgo(40) }),
        link({ id: '3', actorId: 'recent', displayName: 'Bia', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
        link({ id: '4', actorId: 'older', displayName: 'Ana', publicKey: 'pk', lastSyncAt: daysAgo(5) }),
      ],
      NOW,
    );
    expect(views.map((v) => v.actorId)).toEqual(['recent', 'older', 'wait', 'off']);
  });

  it('dedupes by actorId, keeping the freshest sync', () => {
    const views = buildConnectionViews(
      [
        link({ id: 'a', actorId: 'dup', displayName: 'Bruno old', publicKey: 'pk', lastSyncAt: daysAgo(20) }),
        link({ id: 'b', actorId: 'dup', displayName: 'Bruno new', publicKey: 'pk', lastSyncAt: daysAgo(2) }),
      ],
      NOW,
    );
    expect(views).toHaveLength(1);
    expect(views[0]!.displayName).toBe('Bruno new');
    expect(views[0]!.status).toBe('connected');
  });

  it('drops soft-deleted links and nameless entries', () => {
    const views = buildConnectionViews(
      [
        link({ id: 'x', actorId: 'gone', displayName: 'Deleted', deletedAt: daysAgo(1), publicKey: 'pk' }),
        link({ id: 'y', actorId: 'blank', displayName: '   ', publicKey: 'pk' }),
        link({ id: 'z', actorId: 'keep', displayName: 'Real', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(views.map((v) => v.actorId)).toEqual(['keep']);
  });

  it('returns an empty list when there are no links', () => {
    expect(buildConnectionViews([], NOW)).toEqual([]);
  });
});

describe('findReconnectCandidate (B2 wave 3)', () => {
  const bruno = { id: 'p1', name: 'Bruno', linkedActorId: 'old-actor' };

  it('suggests the new device when the current link is offline and one keyed same-name candidate exists', () => {
    const candidate = findReconnectCandidate(
      bruno,
      [
        link({ id: 'cur', actorId: 'old-actor', displayName: 'Bruno', publicKey: null }),
        link({ id: 'new', actorId: 'new-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(candidate).toEqual({ participantId: 'p1', newActorId: 'new-actor', displayName: 'Bruno' });
  });

  it('treats a MISSING current link (no peerLink for the linked actor) as offline → still suggests', () => {
    const candidate = findReconnectCandidate(
      bruno,
      [link({ id: 'new', actorId: 'new-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(2) })],
      NOW,
    );
    expect(candidate?.newActorId).toBe('new-actor');
  });

  it('matches the name accent- and case-insensitively', () => {
    const debora = { id: 'p2', name: 'Débora', linkedActorId: 'old' };
    const candidate = findReconnectCandidate(
      debora,
      [
        link({ id: 'cur', actorId: 'old', displayName: 'Débora', publicKey: null }),
        link({ id: 'new', actorId: 'new-d', displayName: 'debora', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(candidate?.newActorId).toBe('new-d');
  });

  it('counts duplicate links for the same candidate actor as ONE (still suggests)', () => {
    const candidate = findReconnectCandidate(
      bruno,
      [
        link({ id: 'cur', actorId: 'old-actor', displayName: 'Bruno', publicKey: null }),
        link({ id: 'n1', actorId: 'new-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(5) }),
        link({ id: 'n2', actorId: 'new-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(candidate?.newActorId).toBe('new-actor');
  });

  it('returns null when the participant is not linked to any device', () => {
    expect(
      findReconnectCandidate(
        { id: 'p1', name: 'Bruno', linkedActorId: null },
        [link({ actorId: 'x', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(1) })],
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null when the current device is still reachable (keyed but only stale = waiting)', () => {
    expect(
      findReconnectCandidate(
        bruno,
        [
          link({ id: 'cur', actorId: 'old-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(40) }),
          link({ id: 'new', actorId: 'new-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null when the current device is connected', () => {
    expect(
      findReconnectCandidate(
        bruno,
        [
          link({ id: 'cur', actorId: 'old-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
          link({ id: 'new', actorId: 'new-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(0) }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null when two same-name candidates make the match ambiguous (never guess identity)', () => {
    expect(
      findReconnectCandidate(
        bruno,
        [
          link({ id: 'cur', actorId: 'old-actor', displayName: 'Bruno', publicKey: null }),
          link({ id: 'a', actorId: 'new-a', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
          link({ id: 'b', actorId: 'new-b', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(2) }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null when the only candidate has no key (cannot deliver async)', () => {
    expect(
      findReconnectCandidate(
        bruno,
        [
          link({ id: 'cur', actorId: 'old-actor', displayName: 'Bruno', publicKey: null }),
          link({ id: 'new', actorId: 'new-actor', displayName: 'Bruno', publicKey: null }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null when no other link shares the name', () => {
    expect(
      findReconnectCandidate(
        bruno,
        [
          link({ id: 'cur', actorId: 'old-actor', displayName: 'Bruno', publicKey: null }),
          link({ id: 'new', actorId: 'new-actor', displayName: 'Carla', publicKey: 'pk', lastSyncAt: daysAgo(1) }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it('ignores soft-deleted candidate links', () => {
    expect(
      findReconnectCandidate(
        bruno,
        [
          link({ id: 'cur', actorId: 'old-actor', displayName: 'Bruno', publicKey: null }),
          link({ id: 'new', actorId: 'new-actor', displayName: 'Bruno', publicKey: 'pk', lastSyncAt: daysAgo(1), deletedAt: daysAgo(0) }),
        ],
        NOW,
      ),
    ).toBeNull();
  });
});
