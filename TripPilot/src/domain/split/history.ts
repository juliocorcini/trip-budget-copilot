import { claimWeight, computeSplitTotals, distributeProportionally, itemClaimedWeight } from './split';
import type { SplitMode, SplitParticipant, SplitSession } from './types';

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

export interface SplitHistory {
  name: string;
  currency: string;
  mode: SplitMode;
  createdAt: string;
  grandTotalCents: number;
  participantCount: number;
  /** Owner first, then the largest slices on top. */
  entries: SplitHistoryEntry[];
  /** Lines nobody claimed (the owner absorbs these at commit). */
  unclaimed: { description: string; amountCents: number }[];
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

export function buildSplitHistory(session: SplitSession, options?: { ownerName?: string }): SplitHistory {
  const totals = computeSplitTotals(session);
  const ownerName = options?.ownerName?.trim() ?? '';
  const linesByParticipant = session.mode === 'itemized' ? itemizedLinesByParticipant(session) : null;

  const entries: SplitHistoryEntry[] = totals.totals.map((pt) => {
    const participant = session.participants.find((x) => x.id === pt.participantId)!;
    const isOwner = participant.kind === 'owner';
    return {
      participantId: pt.participantId,
      name: isOwner && ownerName !== '' ? ownerName : participant.name,
      channel: splitClaimChannel(participant),
      isOwner,
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
    unclaimed: totals.unclaimed.map((i) => ({ description: i.description, amountCents: i.amountCents })),
  };
}
