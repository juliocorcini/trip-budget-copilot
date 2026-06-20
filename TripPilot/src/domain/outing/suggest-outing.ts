import type { Transaction } from '@/domain/types/transaction';

/**
 * C2 (backlog / UX-clarity §4.12): categories that, logged back-to-back in a
 * short window, hint an unplanned night out ("rolê") is underway. Kept
 * deliberately narrow (bar + restaurant) so a single dinner never trips it.
 */
export const OUTING_SUGGESTION_CATEGORIES: ReadonlySet<string> = new Set(['bar', 'restaurant']);

/** Conservative defaults — a calm trigger (ÂNCORA 10: a nudge, never a block). */
export const OUTING_SUGGESTION_WINDOW_MINUTES = 150;
export const OUTING_SUGGESTION_MIN_COUNT = 3;

export interface OutingSuggestionInput {
  /** "Now" as an ISO timestamp; the window is measured backwards from here. */
  nowIso: string;
  /** Size of the look-back window in minutes (defaults to a conservative 150). */
  windowMinutes?: number;
  /** How many qualifying expenses must fall in the window to fire (default 3). */
  minCount?: number;
}

export interface OutingSuggestion {
  /** Heuristic fired — the UI may show a dismissible nudge. */
  active: boolean;
  /** How many qualifying expenses fell inside the window. */
  count: number;
  /** Timestamp of the earliest qualifying expense in the window (for copy/debug). */
  sinceIso: string | null;
}

const INACTIVE: OutingSuggestion = { active: false, count: 0, sinceIso: null };

/**
 * Pure heuristic: did the traveler just log several bar/restaurant expenses
 * close together? Counts non-deleted EXPENSE transactions in the trigger
 * categories whose creation time sits within `windowMinutes` of `nowIso` (and
 * not in the future). Never reads the clock itself, so it stays deterministic
 * and fully unit-testable. The caller suppresses it while an outing is already
 * active (you are already tracking the ceiling) and after the user dismisses it.
 */
export function evaluateOutingSuggestion(
  transactions: Transaction[],
  {
    nowIso,
    windowMinutes = OUTING_SUGGESTION_WINDOW_MINUTES,
    minCount = OUTING_SUGGESTION_MIN_COUNT,
  }: OutingSuggestionInput,
): OutingSuggestion {
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) return INACTIVE;
  const windowStartMs = nowMs - windowMinutes * 60_000;

  let count = 0;
  let earliestMs = Number.POSITIVE_INFINITY;
  let earliestIso: string | null = null;
  for (const tx of transactions) {
    if (tx.deletedAt !== null) continue;
    if (tx.type !== 'expense') continue;
    if (tx.category === null || !OUTING_SUGGESTION_CATEGORIES.has(tx.category)) continue;
    const createdMs = Date.parse(tx.createdAt);
    if (Number.isNaN(createdMs)) continue;
    if (createdMs < windowStartMs || createdMs > nowMs) continue;
    count += 1;
    if (createdMs < earliestMs) {
      earliestMs = createdMs;
      earliestIso = tx.createdAt;
    }
  }

  return { active: count >= minCount, count, sinceIso: earliestIso };
}
