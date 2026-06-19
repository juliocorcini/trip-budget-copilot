import {
  claimWeight,
  computeSplitTotals,
  distributeEqually,
  distributeProportionally,
  itemClaimedWeight,
} from './split';
import type { SplitItem, SplitMode, SplitParticipant, SplitSession } from './types';

/**
 * "A história do que aconteceu" — the full record of one division for the review
 * screen. The user wants to see, beyond their own slice: who ended up with what,
 * and HOW each person entered the table (the "forma foi escolhido"):
 *
 *  - `owner`      → you (this device / pass-the-phone host)
 *  - `guest_link` → a guest who claimed on THEIR OWN phone via the shared link,
 *                   with no account (ad-hoc participant carrying a device actorId)
 *  - `manual`     → a name YOU typed at the table (ad-hoc, no device)
 *  - `app_linked` → a companion who uses the app and is device-linked (their slice
 *                   falls into their own app as a debt)
 *  - `companion`  → a real trip participant you added, not device-linked
 *
 * Per-claim wall-clock timestamps are intentionally NOT shown: the live protocol
 * only carries a batch `at` that the owner-reducer collapses, so the session
 * snapshot has no trustworthy per-line time. The review screen anchors the moment
 * with the division's `createdAt` and the commit time instead of inventing one.
 */
export type SplitClaimChannel = 'owner' | 'guest_link' | 'manual' | 'app_linked' | 'companion';

export interface SplitHistoryLine {
  description: string;
  /** This person's slice of the line (already prorated for shared lines). */
  amountCents: number;
  /** How many people share the line — 1 = solo, >1 = split. */
  sharedCount: number;
}

export interface SplitHistoryEntry {
  participantId: string;
  name: string;
  channel: SplitClaimChannel;
  isOwner: boolean;
  /** Per-item breakdown (itemized mode only; empty for equal/mine). */
  lines: SplitHistoryLine[];
  itemsCents: number;
  serviceCents: number;
  adjustmentsCents: number;
  totalCents: number;
}

/** One person's stake in a single line (the "item → quem pegou" direction). */
export interface SplitHistoryItemTaker {
  participantId: string;
  name: string;
  channel: SplitClaimChannel;
  isOwner: boolean;
  /** This person's slice of the line, prorated exactly like the totals. */
  shareCents: number;
  /** Fraction of the whole line this person took (1 = solo, 0.5 = half). */
  weight: number;
}

/** A line of the bill with everyone who ended up on it (item-first view). */
export interface SplitHistoryItem {
  itemId: string;
  description: string;
  qty: number;
  /** The line total as printed on the bill. */
  amountCents: number;
  /** What was actually billed to people (min(claimed,1) × line for itemized). */
  billedCents: number;
  /** False only for an itemized line nobody claimed (an orphan/sobra). */
  claimed: boolean;
  takers: SplitHistoryItemTaker[];
}

export interface SplitHistory {
  name: string;
  currency: string;
  mode: SplitMode;
  createdAt: string;
  grandTotalCents: number;
  participantCount: number;
  /** Owner first, then the largest slices on top (person-first view). */
  entries: SplitHistoryEntry[];
  /** Every line with its takers, in bill order (item-first view). */
  items: SplitHistoryItem[];
  /** Lines nobody claimed (the owner absorbs these at commit). */
  unclaimed: { description: string; amountCents: number }[];
}

/** Display identity of a participant (name override for the owner + channel). */
interface ParticipantFace {
  name: string;
  channel: SplitClaimChannel;
  isOwner: boolean;
}

/** Derive how a participant joined the table from their kind + device link. */
export function splitClaimChannel(p: SplitParticipant): SplitClaimChannel {
  if (p.kind === 'owner') return 'owner';
  if (p.kind === 'linked') return p.actorId !== null ? 'app_linked' : 'companion';
  return p.actorId !== null ? 'guest_link' : 'manual';
}

/**
 * Per-participant item lines for itemized mode, using the SAME proration as
 * {@link computeSplitTotals} (billed = claimed fraction × line, distributed by
 * claim weight) so the history reconciles to the authoritative totals to the cent.
 */
function itemizedLinesByParticipant(session: SplitSession): Map<string, SplitHistoryLine[]> {
  const byParticipant = new Map<string, SplitHistoryLine[]>();
  for (const p of session.participants) byParticipant.set(p.id, []);

  for (const item of session.items) {
    const claimedWeight = itemClaimedWeight(item);
    if (claimedWeight <= 0) continue;
    const billed = Math.round(Math.min(claimedWeight, 1) * item.amountCents);
    const weights = item.claims.map((claim) => claimWeight(item, claim));
    const amounts = distributeProportionally(billed, weights);
    const sharedCount = item.claims.length;
    item.claims.forEach((claim, i) => {
      const lines = byParticipant.get(claim.participantId);
      if (!lines) return;
      lines.push({ description: item.description, amountCents: amounts[i] ?? 0, sharedCount });
    });
  }
  return byParticipant;
}

/** Resolve a participant's display face (owner name override + join channel). */
function describeParticipant(p: SplitParticipant, ownerName: string): ParticipantFace {
  const isOwner = p.kind === 'owner';
  return {
    name: isOwner && ownerName !== '' ? ownerName : p.name,
    channel: splitClaimChannel(p),
    isOwner,
  };
}

function taker(
  participantId: string,
  faceById: Map<string, ParticipantFace>,
  shareCents: number,
  weight: number,
): SplitHistoryItemTaker {
  const face = faceById.get(participantId);
  return {
    participantId,
    name: face?.name ?? '',
    channel: face?.channel ?? 'manual',
    isOwner: face?.isOwner ?? false,
    shareCents,
    weight,
  };
}

/** Takers of one line for itemized mode — real claims prorated by weight. */
function itemizedTakers(item: SplitItem, faceById: Map<string, ParticipantFace>): SplitHistoryItemTaker[] {
  const weights = item.claims.map((claim) => claimWeight(item, claim));
  const billed = Math.round(Math.min(itemClaimedWeight(item), 1) * item.amountCents);
  const amounts = distributeProportionally(billed, weights);
  return item.claims.map((claim, i) => taker(claim.participantId, faceById, amounts[i] ?? 0, weights[i] ?? 0));
}

/**
 * The item-first view: every line with everyone who ended up on it. Itemized
 * uses the real claims; equal mode shows the whole table sharing each line; mine
 * attributes every line to the owner — so "que item foi para quem" is always
 * answerable, in every mode, reconciling to the same per-cent proration.
 */
function buildHistoryItems(session: SplitSession, faceById: Map<string, ParticipantFace>): SplitHistoryItem[] {
  const owner = session.participants.find((p) => p.kind === 'owner') ?? session.participants[0] ?? null;
  const headCount = session.participants.length;

  return session.items.map((item) => {
    if (session.mode === 'equal') {
      const amounts = distributeEqually(item.amountCents, headCount);
      const takers = session.participants.map((p, i) =>
        taker(p.id, faceById, amounts[i] ?? 0, headCount > 0 ? 1 / headCount : 0),
      );
      return { itemId: item.id, description: item.description, qty: item.qty, amountCents: item.amountCents, billedCents: item.amountCents, claimed: true, takers };
    }
    if (session.mode === 'mine') {
      const takers = owner ? [taker(owner.id, faceById, item.amountCents, 1)] : [];
      return { itemId: item.id, description: item.description, qty: item.qty, amountCents: item.amountCents, billedCents: item.amountCents, claimed: true, takers };
    }
    const billedCents = Math.round(Math.min(itemClaimedWeight(item), 1) * item.amountCents);
    return {
      itemId: item.id,
      description: item.description,
      qty: item.qty,
      amountCents: item.amountCents,
      billedCents,
      claimed: item.claims.length > 0,
      takers: itemizedTakers(item, faceById),
    };
  });
}

export function buildSplitHistory(session: SplitSession, options?: { ownerName?: string }): SplitHistory {
  const totals = computeSplitTotals(session);
  const ownerName = options?.ownerName?.trim() ?? '';
  const linesByParticipant = session.mode === 'itemized' ? itemizedLinesByParticipant(session) : null;
  const faceById = new Map<string, ParticipantFace>(
    session.participants.map((p) => [p.id, describeParticipant(p, ownerName)]),
  );

  const entries: SplitHistoryEntry[] = totals.totals.map((pt) => {
    const face = faceById.get(pt.participantId)!;
    return {
      participantId: pt.participantId,
      name: face.name,
      channel: face.channel,
      isOwner: face.isOwner,
      lines: linesByParticipant?.get(pt.participantId) ?? [],
      itemsCents: pt.itemsCents,
      serviceCents: pt.serviceCents,
      adjustmentsCents: pt.adjustmentsCents,
      totalCents: pt.totalCents,
    };
  });

  // Owner on top (it's "minha parte"), then the biggest slices first.
  entries.sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    return b.totalCents - a.totalCents;
  });

  return {
    name: session.name,
    currency: session.currency,
    mode: session.mode,
    createdAt: session.createdAt,
    grandTotalCents: totals.grandTotalCents,
    participantCount: session.participants.length,
    entries,
    items: buildHistoryItems(session, faceById),
    unclaimed: totals.unclaimed.map((i) => ({ description: i.description, amountCents: i.amountCents })),
  };
}
