import { describe, it, expect } from 'vitest';
import {
  buildPeoplePicker,
  filterPeoplePicker,
  collectRecentGroupNames,
  type PeoplePickerCandidate,
} from '@/domain/group-split';
import type { ConnectionView } from '@/domain/connections';

// F24 / DEC-355 (G8): the pure group-creation people-picker. These tests pin the
// dedupe contract (the same person never appears twice — merged by actorId then
// by name, keeping the richest identity) and the intent-led ranking.

function conn(over: Partial<ConnectionView> = {}): ConnectionView {
  return {
    actorId: over.actorId ?? 'actor-1',
    displayName: over.displayName ?? 'Bruno',
    status: over.status ?? 'connected',
    lastSyncAt: over.lastSyncAt ?? '2026-06-20T12:00:00.000Z',
    canDeliver: over.canDeliver ?? true,
    participantId: over.participantId ?? null,
  };
}

const findByName = (list: PeoplePickerCandidate[], name: string) =>
  list.find((c) => c.name === name);

describe('buildPeoplePicker — ranking (G8)', () => {
  it('orders connected → trip → recent, preserving input order within a tier', () => {
    const out = buildPeoplePicker({
      connections: [conn({ actorId: 'a', displayName: 'Ana' })],
      tripParticipants: [
        { id: 'p1', name: 'Carla', isOwner: false, linkedActorId: null },
        { id: 'owner', name: 'Júlio', isOwner: true, linkedActorId: null },
      ],
      recentNames: ['Diego'],
    });
    expect(out.map((c) => c.name)).toEqual(['Ana', 'Carla', 'Diego']);
    expect(out.map((c) => c.source)).toEqual(['connected', 'trip', 'recent']);
  });

  it('skips the owner participant and blank names', () => {
    const out = buildPeoplePicker({
      connections: [conn({ actorId: 'a', displayName: '   ' })],
      tripParticipants: [
        { id: 'owner', name: 'Júlio', isOwner: true, linkedActorId: null },
        { id: 'p1', name: '  ', isOwner: false, linkedActorId: null },
        { id: 'p2', name: 'Bruno', isOwner: false, linkedActorId: null },
      ],
      recentNames: ['', '   '],
    });
    expect(out.map((c) => c.name)).toEqual(['Bruno']);
  });

  it('marks canInvite only when the connection holds a public key (canDeliver)', () => {
    const out = buildPeoplePicker({
      connections: [
        conn({ actorId: 'a', displayName: 'Ana', canDeliver: true }),
        conn({ actorId: 'b', displayName: 'Bia', canDeliver: false, status: 'offline' }),
      ],
      tripParticipants: [],
      recentNames: [],
    });
    expect(findByName(out, 'Ana')!.canInvite).toBe(true);
    expect(findByName(out, 'Bia')!.canInvite).toBe(false);
  });
});

describe('buildPeoplePicker — dedupe (G8)', () => {
  it('merges a trip participant into a connection by actorId, enriching participantId', () => {
    const out = buildPeoplePicker({
      connections: [conn({ actorId: 'actor-x', displayName: 'Bruno', participantId: null })],
      tripParticipants: [{ id: 'p9', name: 'Bruno', isOwner: false, linkedActorId: 'actor-x' }],
      recentNames: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: 'Bruno',
      actorId: 'actor-x',
      participantId: 'p9',
      source: 'connected',
      canInvite: true,
    });
  });

  it('merges a trip participant into a connection by name when there is no actor link', () => {
    const out = buildPeoplePicker({
      connections: [conn({ actorId: 'actor-x', displayName: 'Bruno' })],
      tripParticipants: [{ id: 'p9', name: 'bruno', isOwner: false, linkedActorId: null }],
      recentNames: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.participantId).toBe('p9');
    expect(out[0]!.actorId).toBe('actor-x');
  });

  it('drops a recent name that is already shown as a connection or trip person', () => {
    const out = buildPeoplePicker({
      connections: [conn({ actorId: 'a', displayName: 'Ana' })],
      tripParticipants: [{ id: 'p1', name: 'Carla', isOwner: false, linkedActorId: null }],
      recentNames: ['Ana', 'Carla', 'Diego'],
    });
    expect(out.map((c) => c.name)).toEqual(['Ana', 'Carla', 'Diego']);
    expect(out.filter((c) => c.source === 'recent').map((c) => c.name)).toEqual(['Diego']);
  });

  it('keeps two genuinely different connections that share a name (distinct actorIds)', () => {
    const out = buildPeoplePicker({
      connections: [
        conn({ actorId: 'a1', displayName: 'Ana' }),
        conn({ actorId: 'a2', displayName: 'Ana' }),
      ],
      tripParticipants: [],
      recentNames: [],
    });
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.actorId).sort()).toEqual(['a1', 'a2']);
  });

  it('promotes a trip participant to invitable identity when it carries a linkedActorId', () => {
    const out = buildPeoplePicker({
      connections: [],
      tripParticipants: [{ id: 'p1', name: 'Carla', isOwner: false, linkedActorId: 'actor-c' }],
      recentNames: [],
    });
    expect(out[0]).toMatchObject({ actorId: 'actor-c', participantId: 'p1', source: 'trip' });
    // No connection view means we don't know the key — not invitable until connected.
    expect(out[0]!.canInvite).toBe(false);
  });
});

describe('filterPeoplePicker (G8)', () => {
  const list = buildPeoplePicker({
    connections: [conn({ actorId: 'a', displayName: 'Ana' }), conn({ actorId: 'b', displayName: 'Bruno' })],
    tripParticipants: [],
    recentNames: ['Diego'],
  });

  it('returns all candidates for an empty query', () => {
    expect(filterPeoplePicker(list, '   ')).toHaveLength(3);
  });

  it('matches accent- and case-insensitively on a substring', () => {
    expect(filterPeoplePicker(list, 'AN').map((c) => c.name)).toEqual(['Ana']);
    expect(filterPeoplePicker(list, 'eg').map((c) => c.name)).toEqual(['Diego']);
  });
});

describe('collectRecentGroupNames (G8)', () => {
  it('frequency-ranks non-owner names across events, most-used first then alphabetical', () => {
    const names = collectRecentGroupNames([
      { participants: [{ name: 'Júlio', kind: 'owner' }, { name: 'Bruno', kind: 'manual' }, { name: 'Ana', kind: 'manual' }] },
      { participants: [{ name: 'Bruno', kind: 'connected' }, { name: 'Carla', kind: 'manual' }] },
    ]);
    // Bruno appears twice → first; Ana/Carla tie at 1 → alphabetical; owner excluded.
    expect(names).toEqual(['Bruno', 'Ana', 'Carla']);
  });

  it('dedupes by accent-insensitive name and drops blanks', () => {
    const names = collectRecentGroupNames([
      { participants: [{ name: 'Bruno', kind: 'manual' }, { name: 'bruno', kind: 'manual' }, { name: '  ', kind: 'manual' }] },
    ]);
    expect(names).toEqual(['Bruno']);
  });
});
