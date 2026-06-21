import type { SplitSession } from '@/domain/split';

/**
 * C2 (coherence §2.1) — the bridge that lets a SOLO outing become a SHARED bill
 * ("dividir esta saída") in one tap, without rebuilding the split engine or
 * leaving the flow. The outing screen builds a draft {@link SplitSession} from
 * its committed rounds (via `buildSplitFromOuting`) and hands it to
 * {@link SplitPage}, which opens straight on the divide screen.
 *
 * Crucially, the handoff also carries the SOURCE outing's session + transaction
 * ids: when the split is committed, those original solo rounds are soft-deleted
 * in the SAME Dexie transaction (the council's "move, don't duplicate"). The slot
 * is in-memory (a SPA never reloads the module) and consumed exactly once, so a
 * later manual open of the split screen never re-applies a stale outing. Nothing
 * leaves the device.
 */
export interface OutingSplitHandoff {
  session: SplitSession;
  /** The source outing Session id, soft-deleted atomically on split commit. */
  supersedeOutingSessionId: string;
  /** The outing's round transaction ids, soft-deleted atomically on commit. */
  supersedeTransactionIds: string[];
}

let pending: OutingSplitHandoff | null = null;

export function setOutingSplitHandoff(handoff: OutingSplitHandoff): void {
  pending = handoff;
}

/** True when an outing is waiting to open as a split (non-consuming peek). */
export function hasPendingOutingSplitHandoff(): boolean {
  return pending !== null;
}

/** Reads AND clears the handoff (single-use), so a manual reopen never re-applies it. */
export function takeOutingSplitHandoff(): OutingSplitHandoff | null {
  const handoff = pending;
  pending = null;
  return handoff;
}
