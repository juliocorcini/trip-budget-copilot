import { describe, it, expect } from 'vitest';
import { createGroupSplit } from '@/domain/orchestrators';

// A01 / DEC-338 (G3) — creating a group seeds the owner plus any inline people.
// Uses the real orchestrator over the fake-indexeddb db (as the other orchestrator
// suites do); we assert on the returned live event.

describe('createGroupSplit — inline people seeding (A01/DEC-338)', () => {
  it('seeds the owner first, then the given people in order', async () => {
    const event = await createGroupSplit({
      name: 'Bariloche',
      currency: 'BRL',
      ownerName: 'Ana',
      peopleNames: ['Bruno', 'Carla'],
    });
    expect(event.participants.map((p) => p.name)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(event.participants[0]!.kind).toBe('owner');
    expect(event.participants.slice(1).every((p) => p.kind === 'manual')).toBe(true);
    // Owner stays the money authority (ÂNCORA).
    expect(event.ownerParticipantId).toBe(event.participants[0]!.id);
    // Distinct stable ids per participant.
    expect(new Set(event.participants.map((p) => p.id)).size).toBe(3);
  });

  it('trims and skips blank names', async () => {
    const event = await createGroupSplit({
      name: 'Trim',
      currency: 'EUR',
      ownerName: 'Ana',
      peopleNames: ['  ', 'Bia ', ''],
    });
    expect(event.participants.map((p) => p.name)).toEqual(['Ana', 'Bia']);
  });

  it('still creates a valid owner-only event with no extra people', async () => {
    const none = await createGroupSplit({ name: 'Solo', currency: 'EUR', ownerName: 'Ana' });
    expect(none.participants).toHaveLength(1);
    expect(none.participants[0]!.name).toBe('Ana');
    expect(none.expenses).toEqual([]);
    expect(none.status).toBe('open');
  });

  // F24 / DEC-355 (G8) — picked existing/connected people are seeded as `connected`
  // slots linked by their real trip-participant id, BEFORE the manually-typed names.
  it('seeds linked (picked) people as connected slots, before manual names', async () => {
    const event = await createGroupSplit({
      name: 'Trip',
      currency: 'BRL',
      ownerName: 'Ana',
      linkedPeople: [
        { name: 'Bruno', linkedParticipantId: 'part-bruno' },
        { name: 'Carla', linkedParticipantId: null },
      ],
      peopleNames: ['Dani'],
    });
    expect(event.participants.map((p) => p.name)).toEqual(['Ana', 'Bruno', 'Carla', 'Dani']);
    const [, bruno, carla, dani] = event.participants;
    expect(bruno!.kind).toBe('connected');
    expect(bruno!.linkedParticipantId).toBe('part-bruno');
    expect(carla!.kind).toBe('connected');
    expect(carla!.linkedParticipantId).toBeNull();
    expect(dani!.kind).toBe('manual');
  });
});
