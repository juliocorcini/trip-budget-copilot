import type { Transaction } from '@/domain/types/transaction';
import { sumCents } from '@/domain/money';
import { calculatePoolSpent } from './budget';
import type { FreeToSpendResult } from './budget';

/**
 * DEC-447 (G2+G3) — the PhaseSpendLens: ONE canonical reconciliation of every
 * "phase money" number the app shows, so the surfaces stop contradicting each
 * other in front of the user.
 *
 * The G2 investigation (§6-A of the 2026-07-03 orchestrator + the evidence
 * suite `phase-numbers-investigation.test.ts`) proved the confusion is FOUR
 * scopes without a bridge — none of them a math bug:
 *
 *   - the CONFIGURED number is the pool's total (628 in the report);
 *   - the insight "orçamento da fase" is a DERIVED envelope
 *     `free + attributedSpent` (884) that silently absorbs event reserves and
 *     pot spends attributed to the phase;
 *   - the hero is the consumable free (post-reserves, DEC-427);
 *   - the list total is gross, trip-wide (pre-G1) or phase-scoped (G1).
 *
 * This module makes the bridge explicit: `lines` is a display-ready sequence
 * (same pattern as `buildFreeToSpendBreakdown`, DEC-168) whose arithmetic SUMS
 * exactly — verified by tests against the G2 fixture. Per
 * Â-NUMBERS-EVIDENCE-FIRST it CHANGES no number: every value is derived from
 * the same `FreeToSpendResult` and transactions the screens already use.
 */

export interface PhaseSpendLens {
  /** The configured total of the phase's primary pool — the only CONFIGURED number. */
  configuredPhaseBudgetCents: number;
  /** Personal cost attributed to the phase across ALL pools (the insight "spent"). */
  attributedSpentCents: number;
  /** The slice of `attributedSpentCents` that actually drew from the primary pool. */
  consumableSpentCents: number;
  /** Event reserves still held against the phase (consumable remainder, DEC-385). */
  reservedEventCents: number;
  /** Primary-pool spends attributed to OTHER phases (e.g. a future-phase hotel paid now). */
  paidNowOtherPhasesCents: number;
  /** Phase-attributed spends paid from OTHER pools (pots) — what inflates the envelope. */
  otherPoolsCents: number;
  /**
   * DEC-453 (field fix): WHERE the `other_pools` money came from, pool by pool
   * (signed personal-cost cents, biggest first). Sums exactly to
   * `otherPoolsCents`, so the user can trace "+256 de outras verbas" to the
   * actual fund instead of hunting through the app. `poolId` null groups
   * spends that carry no fund at all.
   */
  otherPoolsByPool: Array<{ poolId: string | null; cents: number }>;
  /** Gross trip-wide expense total (the list's "Todas" scope). */
  tripTotalCents: number;
  /** Gross expense total of the phase (the list's phase scope). */
  phaseGrossCents: number;
  /** Gross expense total OUTSIDE the phase — the list's "includes X from other phases". */
  otherPhasesGrossCents: number;
  /** The derived envelope the insight calls "budget": free + attributed spent. */
  calculatedEnvelopeCents: number;
  /** Signed free money now (raw, pre-floor) — envelope − attributed, exactly. */
  freeNowRawCents: number;
  /** Display-ready reconciliation; the lines sum to the envelope and then to free. */
  lines: PhaseSpendLensLine[];
}

export type PhaseSpendLensLineKey =
  | 'configured_budget'
  | 'income'
  | 'protected_reserve'
  | 'future_floor'
  | 'event_reserves'
  | 'planned_purchases'
  | 'paid_other_phases'
  | 'other_pools'
  | 'calculated_envelope'
  | 'attributed_spent'
  | 'free_now';

export type PhaseSpendLensLineKind = 'base' | 'add' | 'subtract' | 'total';

export interface PhaseSpendLensLine {
  key: PhaseSpendLensLineKey;
  /** Non-negative magnitude except `free_now`, which is SIGNED (honest deficit). */
  cents: number;
  kind: PhaseSpendLensLineKind;
}

export interface BuildPhaseSpendLensInput {
  /** The SAME result the screen already computed for the primary pool + phase. */
  fts: FreeToSpendResult;
  /** All trip transactions (live filtering happens inside). */
  transactions: Transaction[];
  phaseId: string;
  /** The primary pool's id (the pool `fts` was computed for). */
  poolId: string;
}

function liveExpenses(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => tx.type === 'expense' && tx.deletedAt === null);
}

export function buildPhaseSpendLens(input: BuildPhaseSpendLensInput): PhaseSpendLens {
  const { fts, transactions, phaseId, poolId } = input;

  const phaseAttributed = transactions.filter(
    (tx) => tx.phaseId === phaseId && tx.deletedAt === null,
  );
  const attributedSpentCents = calculatePoolSpent(phaseAttributed);
  const consumableSpentCents = calculatePoolSpent(
    phaseAttributed.filter((tx) => tx.budgetPoolId === poolId),
  );
  const otherPoolsCents = attributedSpentCents - consumableSpentCents;
  // DEC-453: name each foreign source. Grouped per pool over the SAME rows the
  // `other_pools` total counted, so the sub-lines sum to it exactly.
  const otherPoolTotals = new Map<string | null, number>();
  for (const tx of phaseAttributed) {
    if (tx.budgetPoolId === poolId) continue;
    const cents = calculatePoolSpent([tx]);
    if (cents === 0) continue;
    const key = tx.budgetPoolId ?? null;
    otherPoolTotals.set(key, (otherPoolTotals.get(key) ?? 0) + cents);
  }
  const otherPoolsByPool = [...otherPoolTotals.entries()]
    .map(([id, cents]) => ({ poolId: id, cents }))
    .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  // Primary-pool spend that belongs to OTHER phases = pool total spent (already
  // in `fts`) minus the slice attributed to THIS phase. Same personal-cost rule.
  // SIGNED (no clamp): the line arithmetic below must stay exact even in the
  // refund edge where another phase nets negative.
  const paidNowOtherPhasesCents = fts.totalSpentCents - consumableSpentCents;

  // Gross sums mirror the expense LIST scopes exactly (D-BUG-04: expense-only;
  // income and transfers never enter the list total). DEC-453: in BASE currency
  // (`baseCurrencyAmountCents`) — a mixed-currency trip must not add pounds to
  // euros; same-currency rows have base === amount, so nothing else moves.
  const expenses = liveExpenses(transactions);
  const tripTotalCents = sumCents(expenses.map((tx) => tx.baseCurrencyAmountCents));
  const phaseGrossCents = sumCents(
    expenses.filter((tx) => tx.phaseId === phaseId).map((tx) => tx.baseCurrencyAmountCents),
  );
  const otherPhasesGrossCents = tripTotalCents - phaseGrossCents;

  // The derived envelope the insight labels "budget" — kept IDENTICAL to the
  // production composition (`useDashboardModel` L455): floored free + attributed.
  const calculatedEnvelopeCents = fts.freeToSpendCents + attributedSpentCents;
  // The signed identity uses the RAW free so a deficit is shown, not hidden.
  const freeNowRawCents = fts.freeToSpendRawCents;
  // The LINE arithmetic must always sum, so the envelope line carries the raw
  // (unfloored) sum. It equals `calculatedEnvelopeCents` whenever free ≥ 0 (the
  // normal case); in a deficit it is smaller by exactly the overshoot — honest,
  // instead of silently breaking the addition the block exists to prove.
  const envelopeLineCents = freeNowRawCents + attributedSpentCents;

  // Reconciliation, in the exact algebra proven in G2 (§6-A):
  //   envelope = configured + income − protected − floor − eventRes − planned
  //              − paidNowOtherPhases + otherPools
  //   freeRaw  = envelope − attributed
  // Zero terms are dropped (noise), totals always stay.
  const lines: PhaseSpendLensLine[] = [
    { key: 'configured_budget', cents: fts.totalBudgetCents, kind: 'base' },
  ];
  if (fts.totalIncomeCents > 0) lines.push({ key: 'income', cents: fts.totalIncomeCents, kind: 'add' });
  const subtractions: Array<[PhaseSpendLensLineKey, number]> = [
    ['protected_reserve', fts.protectedReserveCents],
    ['future_floor', fts.futureFloorCents],
    ['event_reserves', fts.eventReservesCents],
    ['planned_purchases', fts.plannedPurchasesCents],
  ];
  for (const [key, cents] of subtractions) {
    if (cents > 0) lines.push({ key, cents, kind: 'subtract' });
  }
  // Signed terms keep the arithmetic exact in refund edges: a negative
  // "paid for other phases" (net refund) flips to an add, and vice versa.
  if (paidNowOtherPhasesCents > 0) {
    lines.push({ key: 'paid_other_phases', cents: paidNowOtherPhasesCents, kind: 'subtract' });
  } else if (paidNowOtherPhasesCents < 0) {
    lines.push({ key: 'paid_other_phases', cents: -paidNowOtherPhasesCents, kind: 'add' });
  }
  if (otherPoolsCents > 0) {
    lines.push({ key: 'other_pools', cents: otherPoolsCents, kind: 'add' });
  } else if (otherPoolsCents < 0) {
    lines.push({ key: 'other_pools', cents: -otherPoolsCents, kind: 'subtract' });
  }
  lines.push({ key: 'calculated_envelope', cents: envelopeLineCents, kind: 'total' });
  lines.push({ key: 'attributed_spent', cents: attributedSpentCents, kind: 'subtract' });
  lines.push({ key: 'free_now', cents: freeNowRawCents, kind: 'total' });

  return {
    configuredPhaseBudgetCents: fts.totalBudgetCents,
    attributedSpentCents,
    consumableSpentCents,
    reservedEventCents: fts.eventReservesCents,
    paidNowOtherPhasesCents,
    otherPoolsCents,
    otherPoolsByPool,
    tripTotalCents,
    phaseGrossCents,
    otherPhasesGrossCents,
    calculatedEnvelopeCents,
    freeNowRawCents,
    lines,
  };
}
