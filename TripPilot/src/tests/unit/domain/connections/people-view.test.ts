import { describe, it, expect } from 'vitest';
import {
  buildPeopleView,
  partitionPeople,
  searchPeople,
  type PersonView,
} from '@/domain/connections';
import type { PeerLink } from '@/domain/types/peer-link';
import type { Participant } from '@/domain/types/participant';

// G9 · DEC-357 — the ONE "Pessoas" view-model. These tests pin the honest badge
// (can I charge live?), the open-balance priority, and that the money it carries
// is the exact ledger net (no value is invented or changed).

function participant(over: Partial<Participant> = {}): Participant {
  return {
    id: over.id ?? 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 0,
    sourceDeviceId: 'device-1',
    tripId: 'trip-1',
    name: over.name ?? 'Ana',
    nickname: over.nickname ?? null,
    isOwner: over.isOwner ?? false,
    email: null,
    linkedUserAccountId: null,
    linkedActorId: over.linkedActorId ?? null,
    ...over,
  };
}

function link(over: Partial<PeerLink> = {}): PeerLink {
  return {
    id: over.id ?? 'l1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 0,
    sourceDeviceId: 'device-1',
    actorId: over.actorId ?? 'actor-1',
    displayName: over.displayName ?? 'Ana',
    participantId: over.participantId ?? null,
    lastSyncAt: over.lastSyncAt ?? null,
    publicKey: over.publicKey ?? null,
    ...over,
  };
}

const byId = (people: PersonView[]) => new Map(people.map((p) => [p.participantId, p]));

/** DEC-474 — build the per-currency balances map from mono-currency EUR nets. */
const eurBalances = (entries: [string, number][]) =>
  new Map(
    entries.map(([id, amountCents]) => [
      id,
      amountCents === 0 ? [] : [{ currency: 'EUR', amountCents }],
    ]),
  );

describe('buildPeopleView — status badge (DEC-357)', () => {
  it('marks a name-only participant as noapp', () => {
    const people = buildPeopleView([participant({ id: 'p1', linkedActorId: null })], new Map(), []);
    expect(people[0]!.status).toBe('noapp');
  });

  it('marks a linked device WITH a captured key as connected (live-chargeable)', () => {
    const people = buildPeopleView(
      [participant({ id: 'p1', linkedActorId: 'actor-1' })],
      new Map(),
      [link({ actorId: 'actor-1', publicKey: 'pk' })],
    );
    expect(people[0]!.status).toBe('connected');
  });

  it('marks a linked device with NO key as invited (paired, not reachable now)', () => {
    const people = buildPeopleView(
      [participant({ id: 'p1', linkedActorId: 'actor-1' })],
      new Map(),
      [link({ actorId: 'actor-1', publicKey: null })],
    );
    expect(people[0]!.status).toBe('invited');
  });

  it('treats a soft-deleted peer link as no key (falls back to invited)', () => {
    const people = buildPeopleView(
      [participant({ id: 'p1', linkedActorId: 'actor-1' })],
      new Map(),
      [link({ actorId: 'actor-1', publicKey: 'pk', deletedAt: '2026-02-01T00:00:00.000Z' })],
    );
    expect(people[0]!.status).toBe('invited');
  });
});

describe('buildPeopleView — money is the unchanged ledger net', () => {
  it('carries the exact signed balance and never lists the owner', () => {
    const balances = eurBalances([
      ['owner', 5000],
      ['p1', -1100],
      ['p2', 2300],
    ]);
    const people = buildPeopleView(
      [
        participant({ id: 'owner', name: 'Eu', isOwner: true }),
        participant({ id: 'p1', name: 'Ana' }),
        participant({ id: 'p2', name: 'Beto' }),
      ],
      balances,
      [],
    );
    const map = byId(people);
    expect(map.has('owner')).toBe(false);
    expect(map.get('p1')!.balanceCents).toBe(-1100);
    expect(map.get('p1')!.balances).toEqual([{ currency: 'EUR', amountCents: -1100 }]);
    expect(map.get('p2')!.balanceCents).toBe(2300);
    expect(map.get('p2')!.balances).toEqual([{ currency: 'EUR', amountCents: 2300 }]);
  });

  it('flags needsAction only for a non-zero balance', () => {
    const people = buildPeopleView(
      [
        participant({ id: 'p1', name: 'Ana' }),
        participant({ id: 'p2', name: 'Beto' }),
      ],
      eurBalances([['p1', -1100], ['p2', 0]]),
      [],
    );
    const map = byId(people);
    expect(map.get('p1')!.needsAction).toBe(true);
    expect(map.get('p2')!.needsAction).toBe(false);
  });

  it('DEC-474: keeps one bucket per currency and never sums across (the perfume case)', () => {
    const people = buildPeopleView(
      [participant({ id: 'felipe', name: 'Felipe' })],
      new Map([
        [
          'felipe',
          [
            { currency: 'BRL', amountCents: -38000 },
            { currency: 'EUR', amountCents: 2000 },
          ],
        ],
      ]),
      [],
    );
    const felipe = people[0]!;
    expect(felipe.balances).toEqual([
      { currency: 'BRL', amountCents: -38000 },
      { currency: 'EUR', amountCents: 2000 },
    ]);
    // needsAction fires even though a naive cross-currency sum could hide it.
    expect(felipe.needsAction).toBe(true);
  });
});

describe('buildPeopleView — priority order', () => {
  it('surfaces open balances first (largest), then connected, then invited, then noapp', () => {
    const people = buildPeopleView(
      [
        participant({ id: 'noapp', name: 'Zeca', linkedActorId: null }),
        participant({ id: 'invited', name: 'Yara', linkedActorId: 'a-inv' }),
        participant({ id: 'connected', name: 'Xuxa', linkedActorId: 'a-con' }),
        participant({ id: 'small', name: 'Bia' }),
        participant({ id: 'big', name: 'Ana' }),
      ],
      eurBalances([['small', 500], ['big', -9000]]),
      [link({ actorId: 'a-con', publicKey: 'pk' }), link({ actorId: 'a-inv', publicKey: null })],
    );
    expect(people.map((p) => p.participantId)).toEqual([
      'big', // open balance, largest magnitude
      'small', // open balance
      'connected',
      'invited',
      'noapp',
    ]);
  });
});

describe('buildPeopleView — de-dupe the same human (DEC-357)', () => {
  it('collapses a manual + linked duplicate into one row, keeping the richer status', () => {
    const people = buildPeopleView(
      [
        participant({ id: 'manual', name: 'Ana', linkedActorId: null }),
        participant({ id: 'linked', name: 'Ana', linkedActorId: 'a-con' }),
      ],
      new Map(),
      [link({ actorId: 'a-con', publicKey: 'pk' })],
    );
    expect(people).toHaveLength(1);
    expect(people[0]!.status).toBe('connected');
    expect(people[0]!.participantId).toBe('linked');
  });

  it('folds a typed name into a linked row of the same name accent/case-insensitively', () => {
    const people = buildPeopleView(
      [
        participant({ id: 'typed', name: 'José', linkedActorId: null }),
        participant({ id: 'linked', name: 'jose', linkedActorId: 'a-con' }),
      ],
      new Map(),
      [link({ actorId: 'a-con', publicKey: 'pk' })],
    );
    expect(people).toHaveLength(1);
    expect(people[0]!.participantId).toBe('linked');
  });

  it('NEVER merges two bare typed names — they may be different people', () => {
    const people = buildPeopleView(
      [
        participant({ id: 'a', name: 'Maria' }),
        participant({ id: 'b', name: 'Maria' }),
      ],
      new Map(),
      [],
    );
    expect(people).toHaveLength(2);
  });
});

describe('buildPeopleView — bilateral connect surfaces unattached friends (DEC-376)', () => {
  it('surfaces a connected peerLink with NO participant as a selectable, materializable row', () => {
    const people = buildPeopleView(
      [],
      new Map(),
      [link({ actorId: 'a-x', displayName: 'David', publicKey: 'pk', participantId: null })],
    );
    expect(people).toHaveLength(1);
    const row = people[0]!;
    expect(row.needsParticipant).toBe(true);
    expect(row.status).toBe('connected');
    expect(row.participantId).toBe(''); // no trip participant yet — materialized on action
    expect(row.linkedActorId).toBe('a-x'); // carries the actor for on-demand dedupe
    expect(row.balanceCents).toBe(0); // nothing to settle until materialized
    expect(row.needsAction).toBe(false);
    expect(row.name).toBe('David');
  });

  it('does NOT surface an unattached friend twice when a participant already maps the actor', () => {
    const people = buildPeopleView(
      [participant({ id: 'p-david', name: 'David', linkedActorId: 'a-x' })],
      new Map(),
      [link({ actorId: 'a-x', displayName: 'David', publicKey: 'pk', participantId: 'p-david' })],
    );
    expect(people).toHaveLength(1);
    expect(people[0]!.participantId).toBe('p-david');
    expect(people[0]!.needsParticipant).toBe(false);
  });

  it('never surfaces an offline (no key) peerLink as a materializable row', () => {
    const people = buildPeopleView(
      [],
      new Map(),
      [link({ actorId: 'a-x', displayName: 'David', publicKey: null, participantId: null })],
    );
    expect(people).toHaveLength(0);
  });

  it('never surfaces a soft-deleted peerLink', () => {
    const people = buildPeopleView(
      [],
      new Map(),
      [link({ actorId: 'a-x', displayName: 'David', publicKey: 'pk', deletedAt: '2026-02-01T00:00:00.000Z' })],
    );
    expect(people).toHaveLength(0);
  });

  it('dedupes multiple peerLinks for the same actor into ONE materializable row', () => {
    const people = buildPeopleView(
      [],
      new Map(),
      [
        link({ id: 'l1', actorId: 'a-x', displayName: 'David', publicKey: 'pk' }),
        link({ id: 'l2', actorId: 'a-x', displayName: 'David', publicKey: 'pk' }),
      ],
    );
    expect(people).toHaveLength(1);
    expect(people[0]!.linkedActorId).toBe('a-x');
  });

  it('skips an unattached friend with no usable name', () => {
    const people = buildPeopleView(
      [],
      new Map(),
      [link({ actorId: 'a-x', displayName: '   ', publicKey: 'pk' })],
    );
    expect(people).toHaveLength(0);
  });
});

describe('partitionPeople — full Pessoas page sections (DEC-359)', () => {
  it('splits into needAction → connected → invited → noapp', () => {
    const people = buildPeopleView(
      [
        participant({ id: 'act', name: 'Ana', linkedActorId: 'a-con' }),
        participant({ id: 'con', name: 'Beto', linkedActorId: 'b-con' }),
        participant({ id: 'inv', name: 'Caio', linkedActorId: 'c-inv' }),
        participant({ id: 'no', name: 'Davi' }),
      ],
      eurBalances([['act', -1000]]),
      [link({ actorId: 'a-con', publicKey: 'pk' }), link({ actorId: 'b-con', publicKey: 'pk' }), link({ actorId: 'c-inv', publicKey: null })],
    );
    const part = partitionPeople(people);
    expect(part.needAction.map((p) => p.participantId)).toEqual(['act']);
    expect(part.connected.map((p) => p.participantId)).toEqual(['con']);
    expect(part.invited.map((p) => p.participantId)).toEqual(['inv']);
    expect(part.noapp.map((p) => p.participantId)).toEqual(['no']);
  });
});

describe('searchPeople', () => {
  const people = buildPeopleView(
    [
      participant({ id: 'p1', name: 'Ana Costa' }),
      participant({ id: 'p2', name: 'Beto', nickname: 'Be' }),
    ],
    new Map(),
    [],
  );

  it('returns all rows for an empty query', () => {
    expect(searchPeople(people, '   ')).toHaveLength(2);
  });

  it('matches on the full name accent/case-insensitively', () => {
    expect(searchPeople(people, 'cost').map((p) => p.participantId)).toEqual(['p1']);
  });

  it('matches on the nickname', () => {
    expect(searchPeople(people, 'be').map((p) => p.participantId)).toEqual(['p2']);
  });
});
