import type { ConnectionView } from '@/domain/connections';

/**
 * F24 / DEC-355 (G8) — the "add existing/connected/trip people at creation" picker,
 * as a PURE ranking + dedupe function (zero React, zero IO). It MERGES three
 * sources the app already maintains — connected friends (`peerLinks` →
 * `buildConnectionViews`), this trip's participants, and recents (names used in
 * past group events) — into ONE de-duplicated, intent-ranked list, so the create
 * flow offers the few likely people up front instead of a wall of names.
 *
 * Dedupe contract: the same person never appears twice. A trip participant folds
 * into a connection by `linkedActorId` (then by name) — keeping the RICHEST
 * identity (the connection's actorId + key, enriched with the trip participantId).
 * A recent name is dropped once it is already shown as a connection or trip person.
 * Two genuinely different connections that share a display name stay separate
 * (distinct actorIds). Ranking is purely by source — connected → trip → recent,
 * input order preserved within a tier (the recents arrive already frequency-ranked
 * from {@link collectRecentGroupNames}).
 */

export type PeoplePickerSource = 'connected' | 'trip' | 'recent';

export interface PeoplePickerCandidate {
  /** Stable selection + de-dupe key (actorId, else `trip:<id>`, else `name:<norm>`). */
  key: string;
  name: string;
  /** The strongest source this person was found through (drives the row badge). */
  source: PeoplePickerSource;
  /** Real trip participant id when known (enables settle-up sync at creation). */
  participantId: string | null;
  /** Peer device actorId when known (addresses the accept-first invite). */
  actorId: string | null;
  /** True only when a connection holds a public key (we can actually reach them). */
  canInvite: boolean;
}

export interface PickerTripParticipant {
  id: string;
  name: string;
  isOwner: boolean;
  /** A connected peer this trip person maps to (DEC-345 `linkedActorId`), if any. */
  linkedActorId: string | null;
}

export interface BuildPeoplePickerInput {
  connections: readonly ConnectionView[];
  tripParticipants: readonly PickerTripParticipant[];
  /** Already frequency-ranked recent names (see {@link collectRecentGroupNames}). */
  recentNames: readonly string[];
}

/** Accent- and case-insensitive name key, so "José" and "jose" match. */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Build the ranked, de-duplicated pick list. Order is source-led (connected →
 * trip → recent) with input order preserved inside each tier.
 */
export function buildPeoplePicker(input: BuildPeoplePickerInput): PeoplePickerCandidate[] {
  const candidates: PeoplePickerCandidate[] = [];
  const byActor = new Map<string, PeoplePickerCandidate>();
  const byName = new Map<string, PeoplePickerCandidate>();

  // 1) Connected friends — unique by actorId; same-name/different-actor stay apart.
  for (const conn of input.connections) {
    const name = conn.displayName.trim();
    if (name.length === 0 || byActor.has(conn.actorId)) continue;
    const candidate: PeoplePickerCandidate = {
      key: conn.actorId,
      name,
      source: 'connected',
      participantId: conn.participantId ?? null,
      actorId: conn.actorId,
      canInvite: conn.canDeliver === true,
    };
    candidates.push(candidate);
    byActor.set(conn.actorId, candidate);
    const norm = normalizeName(name);
    if (!byName.has(norm)) byName.set(norm, candidate);
  }

  // 2) Trip participants — skip the owner + blanks; fold into a connection by
  //    actorId, then by name; otherwise add as a 'trip' candidate.
  for (const tp of input.tripParticipants) {
    if (tp.isOwner) continue;
    const name = tp.name.trim();
    if (name.length === 0) continue;
    const norm = normalizeName(name);
    const merged =
      (tp.linkedActorId ? byActor.get(tp.linkedActorId) : undefined) ?? byName.get(norm);
    if (merged) {
      merged.participantId = merged.participantId ?? tp.id;
      if (!merged.actorId && tp.linkedActorId) merged.actorId = tp.linkedActorId;
      continue;
    }
    const candidate: PeoplePickerCandidate = {
      key: tp.linkedActorId ?? `trip:${tp.id}`,
      name,
      source: 'trip',
      participantId: tp.id,
      actorId: tp.linkedActorId ?? null,
      // No connection view means we can't know the public key — not invitable yet.
      canInvite: false,
    };
    candidates.push(candidate);
    if (tp.linkedActorId) byActor.set(tp.linkedActorId, candidate);
    if (!byName.has(norm)) byName.set(norm, candidate);
  }

  // 3) Recents — drop blanks + anyone already shown; otherwise add as 'recent'.
  for (const rawName of input.recentNames) {
    const name = rawName.trim();
    if (name.length === 0) continue;
    const norm = normalizeName(name);
    if (byName.has(norm)) continue;
    const candidate: PeoplePickerCandidate = {
      key: `name:${norm}`,
      name,
      source: 'recent',
      participantId: null,
      actorId: null,
      canInvite: false,
    };
    candidates.push(candidate);
    byName.set(norm, candidate);
  }

  return candidates;
}

/** Case/accent-insensitive substring search over a built pick list (the search box). */
export function filterPeoplePicker(
  candidates: readonly PeoplePickerCandidate[],
  query: string,
): PeoplePickerCandidate[] {
  const q = normalizeName(query);
  if (q.length === 0) return [...candidates];
  return candidates.filter((c) => normalizeName(c.name).includes(q));
}

/** The minimal event shape `collectRecentGroupNames` reads (a `GroupSplitEvent` fits). */
interface RecentEventLike {
  participants: readonly { name: string; kind: string }[];
}

/**
 * Frequency-rank non-owner participant names across past group events: most-used
 * first, then alphabetical. De-dupes by accent-insensitive name (keeping the first
 * casing seen) and drops blanks. Feeds `recentNames` into {@link buildPeoplePicker}.
 */
export function collectRecentGroupNames(events: readonly RecentEventLike[]): string[] {
  const tally = new Map<string, { name: string; count: number }>();
  for (const event of events) {
    for (const participant of event.participants) {
      if (participant.kind === 'owner') continue;
      const name = participant.name.trim();
      if (name.length === 0) continue;
      const norm = normalizeName(name);
      const existing = tally.get(norm);
      if (existing) existing.count += 1;
      else tally.set(norm, { name, count: 1 });
    }
  }
  return [...tally.values()]
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)))
    .map((entry) => entry.name);
}
