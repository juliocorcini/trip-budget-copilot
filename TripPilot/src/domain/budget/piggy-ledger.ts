/**
 * FB-08 · DEC-279 / DEC-261 (councils C13 + C14) — the cofrinho "buffer" ledger.
 *
 * Model B (RATIFIED by Julio): a day-ordered running balance, derived purely by
 * replaying the immutable daily spend against a constant linear daily ideal:
 *
 *     bal_d = max(0, bal_{d-1} + dailyIdeal − spent_d)
 *
 * Spending UNDER a day's ideal deposits the difference into the piggy; spending
 * OVER it withdraws from the balance (floored at 0). What the balance cannot
 * absorb is the `uncovered` overflow — the part that, in the buffer-aware daily
 * reading, starts cutting the FOLLOWING days' allowance (the C13 buffer).
 *
 * Nothing is persisted (ÂNCORA 11): this recomputes forward on every edit, like
 * a FreeBudget rollover. The final `balanceCents` replaces the old end-clamped
 * `calculatePiggyBank` for display and is the same buffer the per-day "free
 * today" reading respects; `calculateFreeToSpend` (the TOTAL) is untouched.
 *
 * Path-dependence (the whole point of Model B): a day that overspends with an
 * empty piggy CANNOT push the balance negative, so a later great day does not
 * silently repay it — unlike the end-clamped `max(0, idealToDate − spentToDate)`.
 * This is what lets a faithful statement reconcile (C14 invariant:
 * statement balance == displayed balance == buffer). All money is integer cents.
 */
import type { Transaction } from '@/domain/types/transaction';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';
import { addDaysIso, localDayOf } from '@/domain/dates/dates';

export interface PiggyDaySpend {
  /**
   * ISO calendar day (YYYY-MM-DD). Orders the replay and lets the UI extract
   * join each ledger entry back to that day's transactions.
   */
  dateIso: string;
  /** Total spent that day, in base-currency cents (clamped at ≥ 0). */
  spentCents: number;
}

export type PiggyEntryKind = 'deposit' | 'withdrawal' | 'flat';

export interface PiggyLedgerEntry {
  dateIso: string;
  /** The constant daily ideal applied to this day. */
  idealCents: number;
  spentCents: number;
  kind: PiggyEntryKind;
  /** Signed balance change this day: +deposit / −withdrawal / 0. */
  deltaCents: number;
  /** Running balance AFTER this day (≥ 0). */
  balanceCents: number;
  /** Overspend this day the piggy could NOT cover (≥ 0) — eats future days. */
  uncoveredCents: number;
}

export interface PiggyLedger {
  entries: PiggyLedgerEntry[];
  /** Final balance — the displayed cofrinho (replaces `calculatePiggyBank`). */
  balanceCents: number;
  /** Σ of every deposit. */
  totalDepositedCents: number;
  /** Σ of every withdrawal actually taken from the piggy. */
  totalWithdrawnCents: number;
  /** Σ of overspend the piggy could not cover, across all days. */
  totalUncoveredCents: number;
}

export interface BuildPiggyLedgerInput {
  /** Constant linear daily ideal (phaseBudget / totalDays), integer cents. */
  dailyIdealCents: number;
  /** One item per ELAPSED day (zero-spend days included with `spentCents: 0`). */
  spendByDay: PiggyDaySpend[];
}

/**
 * The constant linear daily ideal = phaseBudget / totalDays, in integer cents.
 * Returns 0 for ongoing / no-date phases (totalDays ≤ 0) or a non-positive
 * budget — the caller then HIDES the cofrinho entirely (C14 edge: there is no
 * concept to show when there are no dates).
 */
export function linearDailyIdealCents(phaseBudgetCents: number, totalDays: number): number {
  if (totalDays <= 0 || phaseBudgetCents <= 0) return 0;
  return Math.round(phaseBudgetCents / totalDays);
}

/**
 * Replay the immutable daily spend into the day-ordered buffer ledger. Pure:
 * the same input always yields the same series, and editing a past day simply
 * re-runs this from the start (recalculates forward).
 */
export function buildPiggyLedger(input: BuildPiggyLedgerInput): PiggyLedger {
  const idealCents = Math.max(0, Math.round(input.dailyIdealCents));
  const days = [...input.spendByDay].sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  const entries: PiggyLedgerEntry[] = [];
  let balanceCents = 0;
  let totalDepositedCents = 0;
  let totalWithdrawnCents = 0;
  let totalUncoveredCents = 0;

  for (const day of days) {
    const spentCents = Math.max(0, Math.round(day.spentCents));
    const gross = balanceCents + idealCents - spentCents;
    const nextBalance = Math.max(0, gross);
    const deltaCents = nextBalance - balanceCents;
    const uncoveredCents = gross < 0 ? -gross : 0;

    const kind: PiggyEntryKind =
      deltaCents > 0 ? 'deposit' : deltaCents < 0 ? 'withdrawal' : 'flat';
    if (deltaCents > 0) totalDepositedCents += deltaCents;
    else if (deltaCents < 0) totalWithdrawnCents += -deltaCents;
    totalUncoveredCents += uncoveredCents;

    entries.push({
      dateIso: day.dateIso,
      idealCents,
      spentCents,
      kind,
      deltaCents,
      balanceCents: nextBalance,
      uncoveredCents,
    });
    balanceCents = nextBalance;
  }

  return {
    entries,
    balanceCents,
    totalDepositedCents,
    totalWithdrawnCents,
    totalUncoveredCents,
  };
}

export interface BuildPiggySpendByDayInput {
  /**
   * Transactions ALREADY scoped to the motivation pool (the same set that feeds
   * `calculatePoolSpent`/`fts.totalSpentCents`). Only live expense/adjustment
   * rows count, exactly like the pool-spent total.
   */
  transactions: Transaction[];
  /** Trip start (YYYY-MM-DD) — day 1 of the buffer horizon. */
  startDateIso: string;
  /** Elapsed days to enumerate (≥ 0); zero-spend days still accrue the ideal. */
  daysElapsed: number;
}

/**
 * Decompose the pool's spend into one `PiggyDaySpend` per calendar day so the
 * ledger can accrue the daily ideal on EVERY elapsed day (a no-spend day is a
 * full deposit). Two invariants hold by construction:
 *  - Σ `spentCents` === `calculatePoolSpent(transactions)` — no row is dropped,
 *    even one dated outside the elapsed window (its day is still emitted), so
 *    the buffer balance never diverges from the numbers shown elsewhere.
 *  - every day in `[start, start+daysElapsed)` is present (zero-filled) so the
 *    ideal accrues on idle days. `buildPiggyLedger` re-sorts, so order here is
 *    irrelevant.
 */
export function buildPiggySpendByDay(input: BuildPiggySpendByDayInput): PiggyDaySpend[] {
  const spentByDay = new Map<string, number>();
  for (const tx of input.transactions) {
    if (tx.deletedAt !== null) continue;
    if (tx.type !== 'expense' && tx.type !== 'adjustment') continue;
    const day = localDayOf(tx.date);
    spentByDay.set(day, (spentByDay.get(day) ?? 0) + transactionBasePersonalCostCents(tx));
  }

  const days = new Set<string>();
  const elapsed = Math.max(0, Math.floor(input.daysElapsed));
  for (let i = 0; i < elapsed; i += 1) {
    days.add(addDaysIso(input.startDateIso, i));
  }
  for (const day of spentByDay.keys()) days.add(day);

  return [...days].map((dateIso) => ({ dateIso, spentCents: spentByDay.get(dateIso) ?? 0 }));
}
