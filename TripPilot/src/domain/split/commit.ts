import { computeSplitTotals } from './split';
import type { SplitSession } from './types';

/** One real-trip-participant's slice of the committed bill (in BILL cents). */
export interface SplitCommitShare {
  /** The real trip Participant id (owner or a promoted/linked person). */
  participantId: string;
  amountCents: number;
  isOwner: boolean;
}

/**
 * The financial truth to persist for a committed split, derived purely from the
 * session's computed per-person totals. The orchestrator turns this into one
 * Session + one expense transaction + participant shares (applying FX for the
 * base-currency budget), while the readable item-level division is kept in the
 * SplitRecord (`splitMeta`). Amounts are in the BILL currency; the orchestrator
 * converts to base via the trip's exchange rate.
 */
export interface SplitCommitPlan {
  /** The whole bill (every person's total, incl. unmapped ad-hoc portions). */
  grandTotalCents: number;
  /** The owner's own total — their personal cost (the budget bridge input). */
  ownerCostCents: number;
  /** One slice per REAL participant (owner included), summing to ≤ grandTotal. */
  shares: SplitCommitShare[];
  /** True when at least one non-owner real participant owes a non-zero amount. */
  hasDebtors: boolean;
  /** Dominant item category for the single ledger entry (fallback 'restaurant'). */
  category: string;
}

const DEFAULT_SPLIT_CATEGORY = 'restaurant';

/** The category carrying the most money across the items (ignores 'other'). */
export function dominantSplitCategory(session: SplitSession): string {
  const tally = new Map<string, number>();
  for (const item of session.items) {
    if (item.amountCents <= 0 || item.category === 'other') continue;
    tally.set(item.category, (tally.get(item.category) ?? 0) + item.amountCents);
  }
  let best: string | null = null;
  let bestCents = -1;
  for (const [category, cents] of tally) {
    if (cents > bestCents) {
      best = category;
      bestCents = cents;
    }
  }
  return best ?? DEFAULT_SPLIT_CATEGORY;
}

/**
 * Builds the commit plan from the session and a map of each SplitParticipant to
 * a real trip Participant id. Ad-hoc people without a mapping (E7/§13: ephemeral,
 * never pollute the trip's debts) are left out of the shares — their portion of
 * the bill is paid by the owner's wallet but tracked only in `splitMeta`, never
 * as a trip debt, until the owner promotes them (T5). Pure: no FX, no entities.
 */
export function buildSplitCommitPlan(
  session: SplitSession,
  realIdByParticipant: Record<string, string | null>,
): SplitCommitPlan {
  const totals = computeSplitTotals(session);
  const byRealId = new Map<string, SplitCommitShare>();
  let ownerCostCents = 0;

  for (const participant of session.participants) {
    const realId = realIdByParticipant[participant.id] ?? null;
    const total = totals.totals.find((t) => t.participantId === participant.id);
    const amountCents = total?.totalCents ?? 0;
    if (participant.kind === 'owner') ownerCostCents = amountCents;
    if (realId === null) continue;

    const existing = byRealId.get(realId);
    if (existing) {
      existing.amountCents += amountCents;
      existing.isOwner = existing.isOwner || participant.kind === 'owner';
    } else {
      byRealId.set(realId, { participantId: realId, amountCents, isOwner: participant.kind === 'owner' });
    }
  }

  const shares = Array.from(byRealId.values());
  const hasDebtors = shares.some((s) => !s.isOwner && s.amountCents !== 0);

  return {
    grandTotalCents: totals.grandTotalCents,
    ownerCostCents,
    shares,
    hasDebtors,
    category: dominantSplitCategory(session),
  };
}
