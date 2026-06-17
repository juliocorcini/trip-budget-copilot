import type { WiseImportDraft } from './wise-import';

/**
 * F16 (DEC-200, round 2): the "reimbursement bridge". When a person sends money
 * INTO the Wise account (Bianca +100) shortly after a card purchase (Paylogic
 * −150), that incoming transfer is very likely repaying their share of the
 * purchase. The plain transfer flow can already settle a debt, but only if the
 * debt EXISTS — here the debt was never recorded because the split was never
 * registered. This detector spots the pair so the UI can offer, in one tap, to
 * register the purchase as split (Bianca owed 100 of 150) AND settle it with the
 * incoming money.
 *
 * Pure + suggestion-only (ÂNCORA 10/13): it never mutates anything and never
 * applies on its own — it ranks plausible links by a transparent heuristic
 * (time window + amount ≤ purchase) and the user confirms the person and value.
 */

/** A purchase (expense draft in this batch) the incoming money could repay. */
export interface BridgeCandidate {
  rowId: string;
  description: string;
  /** Full purchase magnitude in cents (always positive). */
  amountCents: number;
  localDay: string;
  category: string;
}

export interface ReimbursementBridge {
  /** The incoming transfer draft that repays part/all of the purchase. */
  transferRowId: string;
  /** Magnitude received (the share being repaid), in cents. */
  transferAmountCents: number;
  /** Statement name of the sender — pre-fills the participant match. */
  counterpartyName: string | null;
  /** The purchase being reimbursed. */
  candidate: BridgeCandidate;
  /** Absolute calendar-day distance between purchase and repayment. */
  daysApart: number;
  /** What the purchase still costs ME after the repayment (≥ 0). */
  ownerShareCents: number;
  /** 0–100 confidence; only links at or above `minScore` are returned. */
  score: number;
}

export interface DetectReimbursementBridgesInput {
  drafts: WiseImportDraft[];
  /** Max absolute day distance between purchase and repayment. Default 21. */
  windowDays?: number;
  /** Minimum confidence to surface a link. Default 55. */
  minScore?: number;
}

const DEFAULT_WINDOW_DAYS = 21;
const DEFAULT_MIN_SCORE = 55;

/** Absolute calendar-day distance between two YYYY-MM-DD days (TZ-agnostic). */
function dayDistance(a: string, b: string): number {
  const toUtc = (day: string): number => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round(Math.abs(toUtc(a) - toUtc(b)) / 86_400_000);
}

/**
 * Confidence that an incoming repayment maps to a purchase. Built from two
 * transparent signals: how close in time they are (dominant) and whether the
 * repayment is a believable share of the purchase. A repayment that lands BEFORE
 * the purchase, or that is a tiny sliver of it, is dampened (still possible, just
 * less certain). Returns 0 when the pair is impossible (repayment > purchase).
 */
function scoreLink(
  transferAmountCents: number,
  candidate: BridgeCandidate,
  transferDay: string,
  windowDays: number,
): number {
  if (transferAmountCents <= 0 || candidate.amountCents <= 0) return 0;
  if (transferAmountCents > candidate.amountCents) return 0;

  const daysApart = dayDistance(transferDay, candidate.localDay);
  if (daysApart > windowDays) return 0;

  let score = 100 - Math.round((daysApart / windowDays) * 45);

  // A repayment normally arrives ON or AFTER the purchase; before it is unusual.
  if (transferDay < candidate.localDay) score -= 12;

  // Amount plausibility. A clean partial share is the canonical case; a full
  // repayment is fine but slightly less "split-like"; a sliver is the weakest.
  const ratio = transferAmountCents / candidate.amountCents;
  if (ratio === 1) score -= 12;
  else if (ratio < 0.15) score -= 22;

  return Math.max(0, Math.min(100, score));
}

/**
 * Finds the most plausible purchase ↔ incoming-repayment links inside a single
 * import batch. Each purchase and each incoming transfer is used at most once
 * (greedy by descending confidence), so two unrelated repayments never claim the
 * same purchase. Only links at or above `minScore` within `windowDays` are
 * returned, sorted strongest-first for display.
 */
export function detectReimbursementBridges(
  input: DetectReimbursementBridgesInput,
): ReimbursementBridge[] {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const minScore = input.minScore ?? DEFAULT_MIN_SCORE;

  const candidates: BridgeCandidate[] = input.drafts
    .filter((d) => d.kind === 'expense' && d.importable && d.status !== 'duplicate_import')
    .map((d) => ({
      rowId: d.rowId,
      description: d.description,
      amountCents: d.amountCents,
      localDay: d.localDay,
      category: d.category,
    }));

  const incoming = input.drafts.filter(
    (d) => d.kind === 'transfer' && d.direction === 'in' && d.status !== 'duplicate_import',
  );

  if (candidates.length === 0 || incoming.length === 0) return [];

  const scored: ReimbursementBridge[] = [];
  for (const transfer of incoming) {
    for (const candidate of candidates) {
      const score = scoreLink(transfer.amountCents, candidate, transfer.localDay, windowDays);
      if (score < minScore) continue;
      scored.push({
        transferRowId: transfer.rowId,
        transferAmountCents: transfer.amountCents,
        counterpartyName: transfer.counterpartyName,
        candidate,
        daysApart: dayDistance(transfer.localDay, candidate.localDay),
        ownerShareCents: candidate.amountCents - transfer.amountCents,
        score,
      });
    }
  }

  // Greedy 1:1 assignment — strongest links win, each side used once.
  scored.sort((a, b) => b.score - a.score || a.daysApart - b.daysApart);
  const usedTransfers = new Set<string>();
  const usedCandidates = new Set<string>();
  const result: ReimbursementBridge[] = [];
  for (const link of scored) {
    if (usedTransfers.has(link.transferRowId) || usedCandidates.has(link.candidate.rowId)) continue;
    usedTransfers.add(link.transferRowId);
    usedCandidates.add(link.candidate.rowId);
    result.push(link);
  }
  return result;
}
