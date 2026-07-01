/**
 * DEC-417 (G5): the Amigo Sincero used to fixate on ONE expense. Its trigger was
 * simply the most-recent expense by date (`sort(date)[0]`), so in a batch import it
 * locked onto whatever happened to be last — often an old, expensive ticket or a
 * trivial coffee — and repeated "this expense took X%" forever. Relevance never
 * entered the choice (proven by `field-fixes-g0-proofs.test.ts` → proof C).
 *
 * This pure selector fixes both halves of the complaint:
 *  1) RELEVANCE — among the most-recent expenses (the recency window), the trigger
 *     is the one that stands out most against the phase's median spend (the biggest
 *     absolute deviation), never just the latest. A €3 coffee never wins over a
 *     notable ticket that shares the window.
 *  2) VARIETY without flicker — when several expenses are genuinely notable (above
 *     the median), a day-derived index rotates the pick across them, so the friend
 *     talks about a different notable expense day to day. The rotation is a pure
 *     function of `daySeed` (the phase day number): STABLE within a day (never
 *     flickers mid-render) and, because consecutive days map to consecutive indices
 *     over a pool of ≥ 2, it never repeats the previous day's pick (built-in dedupe).
 *
 * Everything is pure and deterministic — no persisted "already cited" state that
 * could desync on backup/restore (the Council Red-Team's concern).
 */

export interface AmigoTriggerCandidate {
  id: string;
  /** ISO date (yyyy-mm-dd) that orders the recency window. */
  date: string;
  /** The spend that would drive the read — personal cost in cents. */
  costCents: number;
}

export interface SelectAmigoTriggerOptions {
  /** How many of the most-recent expenses form the candidate window. Default 8. */
  recencyWindow?: number;
  /** How many above-median "notable" expenses the day rotation cycles. Default 3. */
  rotationPool?: number;
  /**
   * A stable per-day integer (the phase day number) that rotates the pick. When
   * ≤ 0 (or omitted) the single most-relevant expense is chosen — no rotation.
   */
  daySeed?: number;
}

const DEFAULT_RECENCY_WINDOW = 8;
const DEFAULT_ROTATION_POOL = 3;

function medianCents(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Most recent first, ties broken by id so the window is stable across input order. */
function byRecencyDesc(a: AmigoTriggerCandidate, b: AmigoTriggerCandidate): number {
  return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
}

/**
 * Biggest deviation from the median first, then the bigger cost, then the more
 * recent, then id — a total order, so the ranking never depends on input order.
 */
function byRelevanceDesc(median: number) {
  return (a: AmigoTriggerCandidate, b: AmigoTriggerCandidate): number =>
    Math.abs(b.costCents - median) - Math.abs(a.costCents - median) ||
    b.costCents - a.costCents ||
    b.date.localeCompare(a.date) ||
    a.id.localeCompare(b.id);
}

export function selectAmigoTrigger(
  candidates: readonly AmigoTriggerCandidate[],
  options: SelectAmigoTriggerOptions = {},
): AmigoTriggerCandidate | null {
  if (candidates.length === 0) return null;

  const recencyWindow = Math.max(1, options.recencyWindow ?? DEFAULT_RECENCY_WINDOW);
  const rotationPool = Math.max(1, options.rotationPool ?? DEFAULT_ROTATION_POOL);
  const daySeed = options.daySeed ?? 0;

  // 1) The recency window — the most-recent expenses only.
  const window = [...candidates].sort(byRecencyDesc).slice(0, recencyWindow);

  // 2) Relevance = deviation from the PHASE median (the whole set, not just the
  //    window), so a spike is judged against the trip's real baseline.
  const median = medianCents(candidates.map((c) => c.costCents));
  const ranked = [...window].sort(byRelevanceDesc(median));

  // 3) The rotation pool = the genuinely notable ones (strictly above the median),
  //    capped. When nothing sits above the median (flat spending), the single most
  //    deviant candidate is used — no forced variety on a boring set (the Critic's
  //    "repeat less rather than force something bland" guard).
  const notable = ranked.filter((c) => c.costCents > median);
  const pool = notable.length > 0 ? notable.slice(0, rotationPool) : [ranked[0]!];

  // 4) Deterministic per-day pick. Consecutive days map to consecutive indices, so
  //    over a pool of ≥ 2 today's pick never equals yesterday's (built-in dedupe).
  const index = pool.length > 1 && daySeed > 0 ? daySeed % pool.length : 0;
  return pool[index] ?? null;
}
