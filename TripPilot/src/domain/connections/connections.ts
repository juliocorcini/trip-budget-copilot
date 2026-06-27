import type { PeerLink } from '@/domain/types/peer-link';

/**
 * B2 (coherence §2.2) — the "Amigos / Conexões" read layer.
 *
 * The DURABLE foundation already exists: `peerLinks` is a GLOBAL (cross-trip)
 * registry, written on every pairing (QR / link / mirror / statement) by
 * `upsertPeerLink`. This module is the PURE view layer on top of it — it never
 * persists or transports anything. It turns raw `PeerLink`s into an honest,
 * sorted friend list so the divide/charge flows can REUSE a known person instead
 * of re-scanning a QR.
 *
 * "Honest state" is the council's hard requirement (no "ghost friends"): we tell
 * the truth about whether we can actually reach this device right now, derived
 * only from what the device already knows (a captured public key + recency).
 */

/** How fresh a sync must be for a keyed peer to read as "connected". */
export const CONNECTION_FRESH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export type ConnectionStatus =
  /** Has a public key AND synced recently — async delivery should work now. */
  | 'connected'
  /** Has a public key but no recent sync — we can send; haven't heard back. */
  | 'waiting'
  /** No public key (paired before mailbox / can't seal async) — re-pair needed. */
  | 'offline';

export interface ConnectionView {
  actorId: string;
  displayName: string;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  /** True when we hold the peer's key, i.e. async messages can be sealed for them. */
  canDeliver: boolean;
  /** The trip Participant this peer last mapped to (may be from another trip). */
  participantId: string | null;
}

/**
 * The honest reachability of a peer, from its captured key + last sync only.
 * No key → can never deliver async (must re-pair). Keyed + recent → connected.
 * Keyed + stale/never → waiting (the message is queued, not confirmed).
 */
export function deriveConnectionStatus(link: PeerLink, nowMs: number): ConnectionStatus {
  if (!link.publicKey) return 'offline';
  if (link.lastSyncAt === null) return 'waiting';
  const last = Date.parse(link.lastSyncAt);
  if (Number.isNaN(last)) return 'waiting';
  return nowMs - last <= CONNECTION_FRESH_WINDOW_MS ? 'connected' : 'waiting';
}

export function toConnectionView(link: PeerLink, nowMs: number): ConnectionView {
  return {
    actorId: link.actorId,
    displayName: link.displayName,
    status: deriveConnectionStatus(link, nowMs),
    lastSyncAt: link.lastSyncAt,
    canDeliver: Boolean(link.publicKey),
    participantId: link.participantId,
  };
}

/** Connected first, then waiting, then offline; within a tier, most-recent, then name. */
const STATUS_RANK: Record<ConnectionStatus, number> = { connected: 0, waiting: 1, offline: 2 };

function lastSyncMs(view: ConnectionView): number {
  if (view.lastSyncAt === null) return 0;
  const ms = Date.parse(view.lastSyncAt);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Build the friend list a picker shows: dedupe by actorId (keep the freshest),
 * drop entries with no usable name, and order by honest status then recency.
 */
export function buildConnectionViews(links: PeerLink[], nowMs: number): ConnectionView[] {
  const freshestByActor = new Map<string, PeerLink>();
  for (const link of links) {
    if (link.deletedAt !== null) continue;
    if (link.displayName.trim() === '') continue;
    const current = freshestByActor.get(link.actorId);
    if (!current) {
      freshestByActor.set(link.actorId, link);
      continue;
    }
    const a = current.lastSyncAt ? Date.parse(current.lastSyncAt) : 0;
    const b = link.lastSyncAt ? Date.parse(link.lastSyncAt) : 0;
    if ((Number.isNaN(b) ? 0 : b) >= (Number.isNaN(a) ? 0 : a)) {
      freshestByActor.set(link.actorId, link);
    }
  }

  return [...freshestByActor.values()]
    .map((link) => toConnectionView(link, nowMs))
    .sort((a, b) => {
      const tier = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (tier !== 0) return tier;
      const recency = lastSyncMs(b) - lastSyncMs(a);
      if (recency !== 0) return recency;
      return a.displayName.localeCompare(b.displayName);
    });
}

/**
 * I1 / DEC-370 — decide what "remove this connected person" tombstones. Pure: the
 * orchestrator applies it. We tombstone every live `PeerLink` for this person —
 * matched by the participant's linked device (`linkedActorId`) AND by any link
 * mapped straight to this `participantId` — and unlink the participant so they
 * stop reading as an active contact. The participant row, its shares and every
 * past division stay untouched (hide-never-delete: only the live connection is
 * severed; history is preserved). The ledger keys off `participantId`, never
 * `actorId`, so severing the device link never moves a cent.
 */
export interface RemoveConnectionPlan {
  /** PeerLink ids to tombstone (soft-delete). */
  linkIdsToTombstone: string[];
  /** Whether to clear the participant's device link (keeps the participant + history). */
  unlinkParticipant: boolean;
}

export function planRemoveConnection(
  participant: { id: string; linkedActorId: string | null },
  links: PeerLink[],
): RemoveConnectionPlan {
  const ids = new Set<string>();
  for (const link of links) {
    if (link.deletedAt !== null) continue;
    const matchesActor =
      participant.linkedActorId !== null && link.actorId === participant.linkedActorId;
    const matchesParticipant = link.participantId === participant.id;
    if (matchesActor || matchesParticipant) ids.add(link.id);
  }
  return {
    linkIdsToTombstone: [...ids],
    unlinkParticipant: participant.linkedActorId !== null,
  };
}

/** Accent- and case-insensitive name key, for matching "the same friend". */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * B2 wave 3 — a safe "reconnect this person's new device" suggestion.
 *
 * When a connected friend re-pairs from a NEW phone they get a NEW `actorId`, so
 * the trip Participant still points at the dead old device. This finds the new
 * device to re-point to, but ONLY in a conservative case the council locked:
 *   - the participant IS linked (`linkedActorId` set) but its current link is
 *     `offline` (no public key / missing) — i.e. genuinely unreachable async;
 *   - there is EXACTLY ONE other link, with a different actorId, a public key,
 *     and the same normalized name.
 * Two same-name candidates (ambiguous), a still-reachable current device, or an
 * unnamed person all return null — never guess a financial identity. The caller
 * confirms with the name in view; re-pointing only changes the delivery address
 * (debts key off `participantId`, never `actorId`), so the ledger is untouched.
 */
export interface ReconnectCandidate {
  participantId: string;
  newActorId: string;
  displayName: string;
}

export function findReconnectCandidate(
  participant: { id: string; name: string; linkedActorId: string | null },
  links: PeerLink[],
  nowMs: number,
): ReconnectCandidate | null {
  if (participant.linkedActorId === null) return null;
  const target = normalizeName(participant.name);
  if (target === '') return null;

  const live = links.filter((l) => l.deletedAt === null);
  const current = live.find((l) => l.actorId === participant.linkedActorId);
  const currentStatus = current ? deriveConnectionStatus(current, nowMs) : 'offline';
  // Only offer to reconnect when the current device truly can't be reached
  // async (no key / gone). A merely-stale keyed link reads "waiting" — leave it.
  if (currentStatus !== 'offline') return null;

  const candidatesByActor = new Map<string, PeerLink>();
  for (const link of live) {
    if (link.actorId === participant.linkedActorId) continue;
    if (!link.publicKey) continue;
    if (normalizeName(link.displayName) !== target) continue;
    const prev = candidatesByActor.get(link.actorId);
    if (!prev) {
      candidatesByActor.set(link.actorId, link);
      continue;
    }
    const a = prev.lastSyncAt ? Date.parse(prev.lastSyncAt) : 0;
    const b = link.lastSyncAt ? Date.parse(link.lastSyncAt) : 0;
    if ((Number.isNaN(b) ? 0 : b) >= (Number.isNaN(a) ? 0 : a)) {
      candidatesByActor.set(link.actorId, link);
    }
  }

  if (candidatesByActor.size !== 1) return null;
  const candidate = [...candidatesByActor.values()][0]!;
  return {
    participantId: participant.id,
    newActorId: candidate.actorId,
    displayName: candidate.displayName,
  };
}
