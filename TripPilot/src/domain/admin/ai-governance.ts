/**
 * FB-18 (DEC-273) — pure Groq-governance math for the Admin dashboard. The
 * worker accounts every AI call server-side (DEC-251: real `usage.total_tokens`)
 * and exposes day/month rollups + the REAL free-tier limits; this module turns
 * those numbers into "% of limit used" and an honest capacity projection ("with
 * today's per-user usage, ~N active AI users fit before we hit a ceiling").
 * No invented numbers — every output derives from measured usage and the
 * verified limits.
 */
export interface GroqLimit {
  /** Requests per day (the practical bottleneck for our daily-capped models). */
  rpd: number;
  /** Tokens per minute (0 = not the binding constraint for this function). */
  tpm: number;
  label: string;
}

export interface GovernanceFnUsage {
  fn: string;
  tokens: number;
  runs: number;
}

/** Percent of a limit consumed, clamped to [0, 100]. 0 when the limit is unknown
 *  (≤ 0) so a missing cap never renders as "Infinity%". */
export function usagePct(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

/**
 * Active-user capacity for ONE function: how many active users fit inside its
 * daily request cap (RPD), given today's average requests/user for it. Returns
 * null when there's no signal yet (no active users, no runs, or no daily cap) so
 * the UI shows "—" instead of a fabricated number.
 */
export function fnUserCapacity(rpd: number, runs: number, activeUsers: number): number | null {
  if (rpd <= 0 || activeUsers <= 0 || runs <= 0) return null;
  const avgPerUser = runs / activeUsers;
  if (avgPerUser <= 0) return null;
  return Math.floor(rpd / avgPerUser);
}

/**
 * The binding projection across all AI functions: the SMALLEST per-function
 * capacity (the first ceiling we'd hit as usage scales). null when nothing is
 * measurable yet. The returned `fn` names which function is the bottleneck.
 */
export function projectActiveUserCapacity(
  byFn: GovernanceFnUsage[],
  limits: Record<string, GroqLimit>,
  activeUsers: number,
): { fn: string; capacity: number } | null {
  let best: { fn: string; capacity: number } | null = null;
  for (const u of byFn) {
    const limit = limits[u.fn];
    if (!limit) continue;
    const capacity = fnUserCapacity(limit.rpd, u.runs, activeUsers);
    if (capacity === null) continue;
    if (best === null || capacity < best.capacity) best = { fn: u.fn, capacity };
  }
  return best;
}
