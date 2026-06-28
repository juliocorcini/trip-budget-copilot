import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import { sumCents } from '@/domain/money';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';
import { getTotalDays } from '@/domain/dates';

/**
 * The budget impact (base-currency personal cost, the SAME rule as
 * `calculatePoolSpent`) of the live expense/adjustment transactions matching a
 * predicate. The shared core of every event-spend sum so attributed spend,
 * outing-session spend and the pool spent all net bit-for-bit. Pure.
 */
function liveSpendBaseCostCents(
  transactions: Transaction[],
  match: (t: Transaction) => boolean,
): number {
  return sumCents(
    transactions
      .filter(
        (t) =>
          t.deletedAt === null &&
          (t.type === 'expense' || t.type === 'adjustment') &&
          match(t),
      )
      .map((t) => transactionBasePersonalCostCents(t)),
  );
}

/**
 * DEC-386 (G1): how much of an event has actually been spent — the sum of the
 * budget impact (base-currency personal cost, the SAME rule as
 * `calculatePoolSpent`) of every live expense/adjustment explicitly attributed
 * to it via `occurrenceId`. This is the input the consumable event reserve
 * (DEC-385, G2) subtracts from `reservedCents`, so the netting against the pool
 * spent is bit-for-bit consistent. Pure.
 */
export function eventAttributedSpent(
  occurrenceId: string,
  transactions: Transaction[],
): number {
  return liveSpendBaseCostCents(transactions, (t) => t.occurrenceId === occurrenceId);
}

/**
 * DEC-385 (G2): the spend that CONSUMES an event's reserve. Two disjoint draws on
 * the same reserved money (a spend is event XOR session, Â-ATTRIBUTION): the
 * explicitly attributed spend (`occurrenceId`) PLUS the spend of an outing
 * started from the event (its `linkedSessionId`). Including the outing spend is
 * what prevents the keystone double count — without it a running event would
 * hold its full reserve AND its outing expenses would land in pool spent, so the
 * event would weigh on the budget twice. Pure.
 */
export function eventConsumedSpentCents(
  occ: PlannedOccurrence,
  transactions: Transaction[],
): number {
  const attributed = eventAttributedSpent(occ.id, transactions);
  const sessionSpent =
    occ.linkedSessionId === null
      ? 0
      : liveSpendBaseCostCents(transactions, (t) => t.sessionId === occ.linkedSessionId);
  return attributed + sessionSpent;
}

/**
 * DEC-385 (G2) — the keystone. The amount of an event's reserve that STILL
 * deducts from free-to-spend: `max(0, reserved − consumed)`. The reserve is held
 * (never released whole when the event "starts") and shrinks as the attributed /
 * outing spend lands in pool spent, so the money is removed from free EXACTLY
 * once and the phase "livre hoje" never jumps. Mirrors the proven planned-purchase
 * reserve (DEC-175). A resolved event (`isConfirmed`, its leftover handled in G4)
 * or a track-only event (`reservedCents === null`) reserves nothing. Pure.
 */
export function eventReserveRemainingCents(
  occ: PlannedOccurrence,
  transactions: Transaction[],
): number {
  if (occ.reservedCents === null || occ.isConfirmed) return 0;
  return Math.max(0, occ.reservedCents - eventConsumedSpentCents(occ, transactions));
}

/**
 * DEC-385 (G2): inclusive number of days the event still spans, counting from
 * today (or its start, if it has not begun) to its end. Drives the per-day
 * allowance; a single-day or already-elapsed event returns 1 (spend it today).
 */
export function eventDaysLeftInclusive(occ: PlannedOccurrence, todayIso: string): number {
  if (occ.plannedDate === null) return 1;
  const planned = occ.plannedDate.slice(0, 10);
  const end = (occ.endDate ?? occ.plannedDate).slice(0, 10);
  const today = todayIso.slice(0, 10);
  const start = today > planned ? today : planned;
  if (start > end) return 1;
  return Math.max(1, getTotalDays(start, end));
}

/**
 * DEC-385 (G2): the per-day allowance for an event — its still-remaining reserve
 * split evenly over the days it still spans (`remaining / daysLeft`, floored).
 * Recomputed each day, so an under-spent day rolls its slack into a larger share
 * tomorrow and an over-spent day shrinks what is left — the multi-day event paces
 * itself the way the phase rhythm paces the trip. Pure.
 */
export function eventDailyAllowanceCents(
  occ: PlannedOccurrence,
  transactions: Transaction[],
  todayIso: string,
): number {
  const remaining = eventReserveRemainingCents(occ, transactions);
  if (remaining <= 0) return 0;
  return Math.floor(remaining / eventDaysLeftInclusive(occ, todayIso));
}

/**
 * Â-ATTRIBUTION (DEC-386): a spend belongs to an event XOR an outing session,
 * never both. True when at most one of the two links is set. The expense factory
 * enforces it by construction (an explicit `occurrenceId` drops the session);
 * this pure guard powers tests and protects the Wise/import paths and legacy
 * records (where a field may read back `undefined`).
 */
export function isEventSessionExclusive(
  tx: { occurrenceId?: string | null; sessionId?: string | null },
): boolean {
  const hasEvent = tx.occurrenceId !== null && tx.occurrenceId !== undefined;
  const hasSession = tx.sessionId !== null && tx.sessionId !== undefined;
  return !(hasEvent && hasSession);
}
