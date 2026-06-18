import { computeSplitTotals, itemsSubtotalCents, serviceChargeAmountCents } from './split';
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
  /** The whole bill (subtotal + service + adjustments); orphans fall on the owner. */
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

  // The owner physically paid the whole bill, so any orphan (unclaimed) value is
  // theirs by default — never dropped (DEC-106: financial truth is never lost,
  // §8.2: the owner resolves the leftovers at commit). computeSplitTotals keeps
  // orphans OUT of the per-person totals (they surface as the "ninguém pegou"
  // nudge), so we bill the FULL ticket and fold that gap back onto the owner.
  // When everything is claimed — or in equal/mine mode — the gap is 0 and this is
  // a no-op.
  const subtotalCents = itemsSubtotalCents(session);
  const serviceCents = serviceChargeAmountCents(session.serviceCharge, subtotalCents);
  const adjustmentsCents = session.adjustments.reduce((sum, adjustment) => sum + adjustment.amountCents, 0);
  const fullBillCents = subtotalCents + serviceCents + adjustmentsCents;
  const orphanGapCents = Math.max(0, fullBillCents - totals.grandTotalCents);

  const byRealId = new Map<string, SplitCommitShare>();
  let ownerCostCents = 0;

  for (const participant of session.participants) {
    const realId = realIdByParticipant[participant.id] ?? null;
    const total = totals.totals.find((t) => t.participantId === participant.id);
    const isOwner = participant.kind === 'owner';
    const amountCents = (total?.totalCents ?? 0) + (isOwner ? orphanGapCents : 0);
    if (isOwner) ownerCostCents = amountCents;
    if (realId === null) continue;

    const existing = byRealId.get(realId);
    if (existing) {
      existing.amountCents += amountCents;
      existing.isOwner = existing.isOwner || isOwner;
    } else {
      byRealId.set(realId, { participantId: realId, amountCents, isOwner });
    }
  }

  const shares = Array.from(byRealId.values());
  const hasDebtors = shares.some((s) => !s.isOwner && s.amountCents !== 0);

  return {
    grandTotalCents: fullBillCents,
    ownerCostCents,
    shares,
    hasDebtors,
    category: dominantSplitCategory(session),
  };
}
