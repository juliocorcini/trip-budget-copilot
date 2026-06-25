import type { DebtEntry } from '@/domain/splitting';
import { computeGroupTransfers } from './group-split';
import type { GroupSplitEvent } from './types';

/**
 * C23 / DEC-306 — the pure bridge that lets a Tricount "enter the trip settle-up"
 * WITHOUT mutating the trip's money ledger. It projects the group's minimum
 * transfers onto trip-participant space, keeping only the edges where BOTH sides
 * are app people linked to the trip (`linkedParticipantId`). A debtor's edge
 * drops the moment their group payment is `confirmed` (settled in-group), so
 * confirming inside the group is exactly what "updates the settle-up".
 *
 * The settle ACTION stays in the group (mark → confirm, m5) — the single source
 * of truth for a group debt — so this output is consumed read-only (folded
 * through `summarizeOwnerDebts`/`suggestSimplifiedSettlements` for display).
 *
 * Currency guard: a group is only bridged when its currency matches the trip
 * base; mixing currencies would sum unlike cents. The caller passes the base.
 */
export function groupSplitToDebts(event: GroupSplitEvent, tripBaseCurrency: string): DebtEntry[] {
  if (event.currency !== tripBaseCurrency) return [];
  const byId = new Map(event.participants.map((p) => [p.id, p]));
  const out: DebtEntry[] = [];
  for (const transfer of computeGroupTransfers(event)) {
    const from = byId.get(transfer.fromParticipantId);
    const to = byId.get(transfer.toParticipantId);
    if (!from?.linkedParticipantId || !to?.linkedParticipantId) continue;
    // The debtor already settled this within the group → not owed in the trip.
    if (from.paymentStatus === 'confirmed') continue;
    out.push({
      debtorId: from.linkedParticipantId,
      debtorName: from.name,
      creditorId: to.linkedParticipantId,
      creditorName: to.name,
      amountCents: transfer.amountCents,
    });
  }
  return out;
}

/**
 * Flatten many trip-linked group events into one debt list (trip-participant
 * space), ready to fold through the trip settle-up's pure summarizers. Standalone
 * groups (no `tripId`) and foreign-currency groups contribute nothing.
 */
export function groupSplitsToTripDebts(
  events: readonly GroupSplitEvent[],
  tripId: string,
  tripBaseCurrency: string,
): DebtEntry[] {
  return events
    .filter((e) => e.tripId === tripId)
    .flatMap((e) => groupSplitToDebts(e, tripBaseCurrency));
}
