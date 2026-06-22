import { createParticipant } from '@/domain/splitting';
import type { Participant } from '@/domain/types/participant';
import type { ConnectionView } from '@/domain/connections';

/**
 * FB-06/FB-24 (DEC-259) — the pure decision layer behind the reusable
 * "add a participant inline" sheet. It NEVER persists or navigates; it only
 * decides whether a typed name / tapped friend maps to an EXISTING trip
 * participant (reuse — no duplicate) or needs a NEW one built. The caller
 * persists only the `'new'` case and then marks it selected. Keeping this pure
 * is what lets the same logic be reused in Quick Add, the receipt and the
 * assistant without each reinventing dedupe rules.
 */

/** Accent- and case-insensitive name key, so "André" === "andre" === " ANDRE ". */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export type ResolvedParticipant =
  | { kind: 'existing'; participant: Participant }
  | { kind: 'new'; participant: Participant };

/**
 * Idempotency by identity: a live, non-owner participant whose name OR nickname
 * matches the typed text. Returns null for an empty name or no match.
 */
export function findParticipantByName(
  participants: Participant[],
  name: string,
): Participant | null {
  const target = normalizeName(name);
  if (target === '') return null;
  return (
    participants.find(
      (p) =>
        !p.isOwner &&
        p.deletedAt === null &&
        (normalizeName(p.name) === target ||
          (p.nickname !== null && normalizeName(p.nickname) === target)),
    ) ?? null
  );
}

/**
 * Resolve a typed name into something to add: reuse an existing match (so the
 * ledger never gets two "Bruno"s), otherwise build a brand-new local
 * participant. Null when the name is blank.
 */
export function resolveParticipantByName(
  tripId: string,
  name: string,
  participants: Participant[],
): ResolvedParticipant | null {
  const clean = name.trim();
  if (clean === '') return null;
  const existing = findParticipantByName(participants, clean);
  if (existing) return { kind: 'existing', participant: existing };
  return { kind: 'new', participant: createParticipant(tripId, clean, null) };
}

/**
 * Resolve a connected friend into something to add: reuse the trip participant
 * already mapped to its actor (so a real debt can ride the mirror), otherwise
 * build a new one carrying `linkedActorId`. Never duplicates by actor.
 */
export function resolveParticipantFromConnection(
  tripId: string,
  connection: ConnectionView,
  participants: Participant[],
): ResolvedParticipant {
  const mapped = participants.find(
    (p) => p.deletedAt === null && p.linkedActorId === connection.actorId,
  );
  if (mapped) return { kind: 'existing', participant: mapped };
  const created = createParticipant(tripId, connection.displayName, null);
  return { kind: 'new', participant: { ...created, linkedActorId: connection.actorId } };
}

/**
 * The connected friends a picker should still offer: those whose actor is not
 * already mapped to a live trip participant (so we don't list someone twice).
 */
export function availableConnections(
  connections: ConnectionView[],
  participants: Participant[],
): ConnectionView[] {
  const takenActors = new Set(
    participants
      .filter((p) => p.deletedAt === null && p.linkedActorId !== null)
      .map((p) => p.linkedActorId),
  );
  return connections.filter((c) => !takenActors.has(c.actorId));
}
