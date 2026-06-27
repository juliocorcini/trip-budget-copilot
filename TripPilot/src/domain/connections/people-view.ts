import type { PeerLink } from '@/domain/types/peer-link';
import type { Participant } from '@/domain/types/participant';

/**
 * G9 · DEC-357 — the ONE "Pessoas" view-model.
 *
 * The settle-up screen used to show TWO lists for the same humans: a "Pessoas"
 * balance list and a separate device-flavoured "Conexões" list. The dichotomy
 * itself was the confusion (Julio: "não sei a diferença"). This pure layer folds
 * them into a single, deduped, status-badged list: a person has **attributes**
 * (can I charge them live? do we have an open balance?), not a category.
 *
 * It changes NOTHING about the money — the balance it carries is the exact net
 * `calculateParticipantBalances` already produces (ledger-math invariance). It
 * only decides the badge and the sort, so the same humans read as one list.
 */

/** The single badge vocabulary (DEC-357). `connected` = can charge live. */
export type PersonStatus = 'connected' | 'invited' | 'noapp';

export interface PersonView {
  participantId: string;
  /** Display label — the nickname when set, else the name. */
  name: string;
  /** The full participant name (search + de-dupe key). */
  fullName: string;
  nickname: string | null;
  linkedActorId: string | null;
  /** Capability badge: live-chargeable / paired-but-unreachable / name-only. */
  status: PersonStatus;
  /** Signed net cents — `> 0` they receive, `< 0` they owe (unchanged ledger). */
  balanceCents: number;
  /** True when there is an open balance to resolve (the owner is never listed). */
  needsAction: boolean;
  /** 1–2 char avatar initials. */
  initials: string;
  /**
   * DEC-376 (Â-BILATERAL) — true for a connected friend who has NO trip
   * participant yet (surfaced straight from a `peerLink(participantId:null)`, e.g.
   * after a reverse connect handshake). `participantId` is empty until the UI
   * materializes it on-demand (dedupe by `actorId`) on the first charge/split.
   * Until then there is nothing to settle (`balanceCents` is 0).
   */
  needsParticipant: boolean;
}

export interface PeoplePartition {
  /** Open balance (owes / is owed) — surfaced first, regardless of status. */
  needAction: PersonView[];
  connected: PersonView[];
  invited: PersonView[];
  noapp: PersonView[];
}

/** Accent- and case-insensitive name key, matching the connections layer. */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 1).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

const STATUS_RANK: Record<PersonStatus, number> = { connected: 0, invited: 1, noapp: 2 };

/** Connected outranks invited outranks name-only when collapsing duplicates. */
function isBetterRow(candidate: PersonView, current: PersonView): boolean {
  if (candidate.needsAction !== current.needsAction) return candidate.needsAction;
  return STATUS_RANK[candidate.status] < STATUS_RANK[current.status];
}

/**
 * Build the unified people list from the data the settle-up screen already has.
 * The owner is excluded — their position is the balance hero, not a row. Status
 * is honest and derived only from local facts: a linked device with a captured
 * key can be charged live (`connected`); linked without a key is `invited`
 * (paired/queued, not reachable now); a plain typed name is `noapp`.
 */
export function buildPeopleView(
  participants: Participant[],
  balances: Map<string, number>,
  peerLinks: PeerLink[],
): PersonView[] {
  const keyedActors = new Set<string>();
  for (const link of peerLinks) {
    if (link.deletedAt !== null) continue;
    if (link.publicKey) keyedActors.add(link.actorId);
  }

  // A linked device with a captured key is live-chargeable; linked without a
  // key is "invited" (paired/queued, not reachable now); no link is name-only.
  const deriveStatus = (linkedActorId: string | null): PersonStatus => {
    if (!linkedActorId) return 'noapp';
    return keyedActors.has(linkedActorId) ? 'connected' : 'invited';
  };

  // Names already owned by a LINKED participant — a manual row of the same name
  // is the same human typed before linking, so it folds into the linked one. Two
  // bare typed names are NOT merged (they may be two different people).
  const linkedNames = new Set<string>();
  for (const p of participants) {
    if (!p.isOwner && p.linkedActorId) linkedNames.add(normalizeName(p.name));
  }

  const toView = (p: Participant): PersonView => {
    const balanceCents = balances.get(p.id) ?? 0;
    return {
      participantId: p.id,
      name: p.nickname ?? p.name,
      fullName: p.name,
      nickname: p.nickname,
      linkedActorId: p.linkedActorId,
      status: deriveStatus(p.linkedActorId),
      balanceCents,
      needsAction: balanceCents !== 0,
      initials: initialsOf(p.nickname ?? p.name),
      needsParticipant: false,
    };
  };

  const byKey = new Map<string, PersonView>();
  for (const p of participants) {
    if (p.isOwner) continue;
    // A bare typed name superseded by a linked record of the same name → skip.
    if (!p.linkedActorId && linkedNames.has(normalizeName(p.name))) continue;
    // Linked rows collapse by device (same actorId == same human); typed rows
    // stay unique per participant so no real person is ever hidden.
    const key = p.linkedActorId ? `actor:${p.linkedActorId}` : `pid:${p.id}`;
    const view = toView(p);
    const existing = byKey.get(key);
    if (!existing || isBetterRow(view, existing)) byKey.set(key, view);
  }

  // DEC-376 (Â-BILATERAL) — a friend who connected with ME but whom I never added
  // to THIS trip lives only as a `peerLink(participantId:null)` (e.g. a reverse
  // connect handshake). Surface every such KEYED (live-chargeable) friend as a
  // selectable row so the connection shows on BOTH sides; the participant is
  // materialized on-demand (dedupe by `actorId`) the first time I charge/split
  // them. We skip any actor already represented by a participant row, so the same
  // human is never listed twice (dedupe key = actorId, the council's lock).
  const shownActors = new Set<string>();
  for (const view of byKey.values()) {
    if (view.linkedActorId) shownActors.add(view.linkedActorId);
  }
  for (const link of peerLinks) {
    if (link.deletedAt !== null) continue;
    if (!link.publicKey) continue; // only friends we can actually deliver to
    if (link.displayName.trim() === '') continue; // no usable name
    const key = `actor:${link.actorId}`;
    if (shownActors.has(link.actorId) || byKey.has(key)) continue;
    byKey.set(key, {
      participantId: '',
      name: link.displayName,
      fullName: link.displayName,
      nickname: null,
      linkedActorId: link.actorId,
      status: 'connected',
      balanceCents: 0,
      needsAction: false,
      initials: initialsOf(link.displayName),
      needsParticipant: true,
    });
  }

  return [...byKey.values()].sort(comparePeople);
}

/** needs-action first (largest balance), then connected → invited → noapp by name. */
function comparePeople(a: PersonView, b: PersonView): number {
  if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
  if (a.needsAction && b.needsAction) {
    const byAmount = Math.abs(b.balanceCents) - Math.abs(a.balanceCents);
    if (byAmount !== 0) return byAmount;
    return a.name.localeCompare(b.name);
  }
  const tier = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (tier !== 0) return tier;
  return a.name.localeCompare(b.name);
}

/**
 * Split the unified list into the full Pessoas page's status sections
 * (DEC-359), priority order: open balances → connected → invited → no-app.
 */
export function partitionPeople(people: PersonView[]): PeoplePartition {
  const partition: PeoplePartition = { needAction: [], connected: [], invited: [], noapp: [] };
  for (const person of people) {
    if (person.needsAction) partition.needAction.push(person);
    else partition[person.status].push(person);
  }
  return partition;
}

/** Filter the unified list by a free-text query over the name + nickname. */
export function searchPeople(people: PersonView[], query: string): PersonView[] {
  const q = normalizeName(query);
  if (q === '') return people;
  return people.filter(
    (p) => normalizeName(p.fullName).includes(q) || normalizeName(p.name).includes(q),
  );
}
