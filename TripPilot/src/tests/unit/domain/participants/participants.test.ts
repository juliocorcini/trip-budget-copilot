import { describe, it, expect } from 'vitest';
import {
  findParticipantByName,
  resolveParticipantByName,
  resolveParticipantFromConnection,
  availableConnections,
} from '@/domain/participants';
import { createParticipant } from '@/domain/splitting';
import type { Participant } from '@/domain/types/participant';
import type { ConnectionView } from '@/domain/connections';

function mkParticipant(overrides: Partial<Participant> = {}): Participant {
  return { ...createParticipant('trip-1', 'Bruno', null), ...overrides };
}

function mkConnection(overrides: Partial<ConnectionView> = {}): ConnectionView {
  return {
    actorId: 'actor-1',
    displayName: 'Ana',
    status: 'connected',
    lastSyncAt: null,
    canDeliver: true,
    participantId: null,
    ...overrides,
  };
}

describe('findParticipantByName (FB-06/24 idempotency)', () => {
  it('matches a non-owner by name, accent- and case-insensitively', () => {
    const people = [mkParticipant({ name: 'André' })];
    expect(findParticipantByName(people, 'andre')!.name).toBe('André');
    expect(findParticipantByName(people, '  ANDRE  ')!.name).toBe('André');
  });

  it('matches by nickname too', () => {
    const people = [mkParticipant({ name: 'Roberto', nickname: 'Beto' })];
    expect(findParticipantByName(people, 'beto')!.name).toBe('Roberto');
  });

  it('never matches the owner (the owner is "you", not a companion)', () => {
    const people = [mkParticipant({ name: 'Me', isOwner: true })];
    expect(findParticipantByName(people, 'me')).toBeNull();
  });

  it('ignores soft-deleted participants', () => {
    const people = [mkParticipant({ name: 'Gone', deletedAt: new Date().toISOString() })];
    expect(findParticipantByName(people, 'gone')).toBeNull();
  });

  it('returns null for a blank name or no match', () => {
    const people = [mkParticipant({ name: 'Bruno' })];
    expect(findParticipantByName(people, '   ')).toBeNull();
    expect(findParticipantByName(people, 'Carlos')).toBeNull();
  });
});

describe('resolveParticipantByName', () => {
  it('reuses an existing match instead of creating a duplicate', () => {
    const bruno = mkParticipant({ name: 'Bruno' });
    const resolved = resolveParticipantByName('trip-1', 'bruno', [bruno]);
    expect(resolved).toEqual({ kind: 'existing', participant: bruno });
  });

  it('builds a brand-new local participant when the name is unknown', () => {
    const resolved = resolveParticipantByName('trip-1', 'Carla', []);
    expect(resolved!.kind).toBe('new');
    expect(resolved!.participant.name).toBe('Carla');
    expect(resolved!.participant.tripId).toBe('trip-1');
    expect(resolved!.participant.isOwner).toBe(false);
    expect(resolved!.participant.linkedActorId).toBeNull();
  });

  it('trims and rejects a blank name', () => {
    expect(resolveParticipantByName('trip-1', '   ', [])).toBeNull();
  });
});

describe('resolveParticipantFromConnection', () => {
  it('reuses the trip participant already mapped to that actor', () => {
    const mapped = mkParticipant({ name: 'Ana', linkedActorId: 'actor-1' });
    const resolved = resolveParticipantFromConnection('trip-1', mkConnection(), [mapped]);
    expect(resolved).toEqual({ kind: 'existing', participant: mapped });
  });

  it('builds a new participant carrying the actor id when not yet on the trip', () => {
    const resolved = resolveParticipantFromConnection('trip-1', mkConnection({ displayName: 'Ana' }), []);
    expect(resolved.kind).toBe('new');
    expect(resolved.participant.name).toBe('Ana');
    expect(resolved.participant.linkedActorId).toBe('actor-1');
  });
});

describe('availableConnections', () => {
  it('drops friends whose actor is already a live participant, keeps the rest', () => {
    const connections = [
      mkConnection({ actorId: 'a', displayName: 'Ana' }),
      mkConnection({ actorId: 'b', displayName: 'Bia' }),
    ];
    const participants = [mkParticipant({ name: 'Ana', linkedActorId: 'a' })];
    const available = availableConnections(connections, participants);
    expect(available.map((c) => c.actorId)).toEqual(['b']);
  });

  it('keeps a friend whose mapped participant was soft-deleted (re-addable)', () => {
    const connections = [mkConnection({ actorId: 'a' })];
    const participants = [
      mkParticipant({ linkedActorId: 'a', deletedAt: new Date().toISOString() }),
    ];
    expect(availableConnections(connections, participants).map((c) => c.actorId)).toEqual(['a']);
  });
});
