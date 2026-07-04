import type { Transaction } from '@/domain/types/transaction';
import { sumCents } from '@/domain/money';
import { calculatePoolSpent } from './budget';
import type { FreeToSpendResult } from './budget';

/**
 * DEC-447 (G2+G3) + DEC-456 (field verdict 2026-07-03) — the PhaseSpendLens:
 * ONE canonical reconciliation of every "phase money" number the app shows.
 *
 * DEC-456 changed the MATH SCOPE (with Julio's explicit verdict, satisfying
 * Â-NUMBERS-EVIDENCE-FIRST): the phase budget arithmetic uses ONLY the phase's
 * primary fund. Money attributed to the phase but paid from OTHER pools —
 * global pots like "Tomorrowland", other-phase funds, or no fund at all — no
 * longer inflates the envelope ("+150 do pote" grew the budget, which read as
 * nonsense: a pot is trip money, not phase money). Those spends now live in a
 * separate INFORMATIVE section (`kind: 'info'`) that names each source but
 * never enters the sums.
 *
 * The invariant holds: `freeNowRawCents` (the hero free) is untouched —
 * algebraically, freeRaw + primaryPoolSpend = configured + income − reserves −
 * paidOtherPhases, exactly, so the lines still SUM with no fudge term.
 */

export interface PhaseSpendLens {
  /** The configured total of the phase's primary pool — the only CONFIGURED number. */
  configuredPhaseBudgetCents: number;
  /** INFO — personal cost attributed to the phase across ALL pools (the list-ish total). */
  attributedSpentCents: number;
  /** The slice of `attributedSpentCents` paid from the primary pool — the ONLY spend in the math. */
  consumableSpentCents: number;
  /** Event reserves still held against the phase (consumable remainder, DEC-385). */
  reservedEventCents: number;
  /** Primary-pool spends attributed to OTHER phases (e.g. a future-phase hotel paid now). */
  paidNowOtherPhasesCents: number;
  /** INFO — phase-attributed spends paid from OTHER pools (pots/funds). Not in the math (DEC-456). */
  otherPoolsCents: number;
  /**
   * DEC-453 (field fix): WHERE the informative `other_pools` money came from,
   * pool by pool (signed personal-cost cents, biggest first). Sums exactly to
   * `otherPoolsCents`. `poolId` null groups spends that carry no fund at all.
   */
  otherPoolsByPool: Array<{ poolId: string | null; cents: number }>;
  /** Gross trip-wide expense total (the list's "Todas" scope). */
  tripTotalCents: number;
  /** Gross expense total of the phase (the list's phase scope). */
  phaseGrossCents: number;
  /** Gross expense total OUTSIDE the phase — the list's "includes X from other phases". */
  otherPhasesGrossCents: number;
  /** The derived envelope: floored free + primary-pool spend (DEC-456 scope). */
  calculatedEnvelopeCents: number;
  /** Signed free money now (raw, pre-floor) — envelope − primary-pool spend, exactly. */
  freeNowRawCents: number;
  /** Display-ready reconciliation; arithmetic lines sum, `info` lines never count. */
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
  | 'phase_pool_spent'
  | 'free_now';

/** DEC-456: `info` renders in a separate section and NEVER enters the sums. */
export type PhaseSpendLensLineKind = 'base' | 'add' | 'subtract' | 'total' | 'info';

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

  // DEC-456: the envelope is PHASE MONEY ONLY — floored free + primary-pool
  // spend. Other pools no longer inflate it (kept identical to the production
  // composition in `useDashboardModel`, which feeds the same scope to insights).
  const calculatedEnvelopeCents = fts.freeToSpendCents + consumableSpentCents;
  // The signed identity uses the RAW free so a deficit is shown, not hidden.
  const freeNowRawCents = fts.freeToSpendRawCents;
  // The LINE arithmetic must always sum, so the envelope line carries the raw
  // (unfloored) sum. It equals `calculatedEnvelopeCents` whenever free ≥ 0 (the
  // normal case); in a deficit it is smaller by exactly the overshoot — honest,
  // instead of silently breaking the addition the block exists to prove.
  const envelopeLineCents = freeNowRawCents + consumableSpentCents;

  // Reconciliation, in the DEC-456 algebra:
  //   envelope = configured + income − protected − floor − eventRes − planned
  //              − paidNowOtherPhases
  //   freeRaw  = envelope − phasePoolSpent
  // Zero terms are dropped (noise), totals always stay. Other-pool money is an
  // `info` line AFTER the sums — visible, named, never counted.
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
  lines.push({ key: 'calculated_envelope', cents: envelopeLineCents, kind: 'total' });
  lines.push({ key: 'phase_pool_spent', cents: consumableSpentCents, kind: 'subtract' });
  lines.push({ key: 'free_now', cents: freeNowRawCents, kind: 'total' });
  if (otherPoolsCents !== 0) {
    lines.push({ key: 'other_pools', cents: otherPoolsCents, kind: 'info' });
  }

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
