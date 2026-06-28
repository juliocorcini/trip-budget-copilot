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

/** DEC-390 (parte 2, G1): one contributing spend in the live-event block. */
export interface LiveEventExpense {
  id: string;
  date: string;
  description: string;
  category: string | null;
  /** Base-currency personal cost — the SAME unit that nets into `consumedCents`. */
  baseCostCents: number;
  /** How this spend draws on the event: explicitly attributed XOR via the outing. */
  source: 'attributed' | 'outing';
}

/** DEC-390 (parte 2, G1): the live progress of an event that is happening now. */
export interface LiveEventProgress {
  occurrence: PlannedOccurrence;
  /** The reserve set aside for the event (null = track-only, no envelope). */
  reservedCents: number | null;
  /** What has actually been drawn (attributed + linked-outing spend). */
  consumedCents: number;
  /** Still-held reserve: `max(0, reserved − consumed)` (0 when track-only). */
  remainingCents: number;
  /** Today's share of what is left: `remaining / daysLeft` (0 when exhausted). */
  perDayCents: number;
  /** Inclusive days the event still spans, from today to its end. */
  daysLeftInclusive: number;
  /** The outing started from this event, if any (the live tally lives there). */
  linkedSessionId: string | null;
  /** The spends that make up `consumedCents` — what/when/how-much, newest first. */
  expenses: LiveEventExpense[];
}

/**
 * DEC-390 (parte 2, G1): the live-event progress view-model — everything the Home
 * "Evento acontecendo" block needs to answer "how is my event going?" in one
 * glance: consumed (with the contributing spends, what/when/how-much), still-held
 * reserve, today's per-day share, and days left. The contributing spends are the
 * SAME union `eventConsumedSpentCents` sums (explicit `occurrenceId` XOR the
 * linked outing's `sessionId`), so the listed lines net bit-for-bit to
 * `consumedCents` with NO double count, and the block coexists with the outing
 * card (Â-LIVE-EVENT) instead of replacing it. Pure (TS only, no React).
 */
export function buildLiveEventProgress(
  occ: PlannedOccurrence,
  transactions: Transaction[],
  todayIso: string,
): LiveEventProgress {
  const expenses: LiveEventExpense[] = transactions
    .filter(
      (t) =>
        t.deletedAt === null &&
        (t.type === 'expense' || t.type === 'adjustment') &&
        (t.occurrenceId === occ.id ||
          (occ.linkedSessionId !== null && t.sessionId === occ.linkedSessionId)),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      category: t.category,
      baseCostCents: transactionBasePersonalCostCents(t),
      source: t.occurrenceId === occ.id ? 'attributed' : 'outing',
    }));
  return {
    occurrence: occ,
    reservedCents: occ.reservedCents,
    consumedCents: eventConsumedSpentCents(occ, transactions),
    remainingCents: eventReserveRemainingCents(occ, transactions),
    perDayCents: eventDailyAllowanceCents(occ, transactions, todayIso),
    daysLeftInclusive: eventDaysLeftInclusive(occ, todayIso),
    linkedSessionId: occ.linkedSessionId,
    expenses,
  };
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

/**
 * DEC-387 (G4): whether the event's date interval is fully in the past — its end
 * (the `endDate`, or the single `plannedDate`) is strictly before today. A
 * dateless event never "ends". Pure (day-granular, time component ignored).
 */
export function eventHasEnded(occ: PlannedOccurrence, todayIso: string): boolean {
  const end = occ.endDate ?? occ.plannedDate;
  if (end === null) return false;
  return end.slice(0, 10) < todayIso.slice(0, 10);
}

/** DEC-387 (G4): an ended event whose reserve still holds unspent money. */
export interface PendingEventLeftover {
  occurrence: PlannedOccurrence;
  /** `max(0, reserved − consumed)` still held — the amount to be resolved. */
  leftoverCents: number;
}

/**
 * DEC-387 (G4): an event has a PENDING leftover when it has ended (its days are
 * past) and its consumable reserve still holds money (`remaining > 0`) that the
 * user has not yet resolved (`isConfirmed` false — set true once resolved). The
 * money is never auto-decided: it stays held (out of free) until the user picks a
 * destination, so nothing is lost (Â-LEFTOVER-CONSERVED, A4). Pure.
 */
export function isEventLeftoverPending(
  occ: PlannedOccurrence,
  transactions: Transaction[],
  todayIso: string,
): boolean {
  return (
    occ.kind === 'event' &&
    occ.deletedAt === null &&
    eventHasEnded(occ, todayIso) &&
    eventReserveRemainingCents(occ, transactions) > 0
  );
}

/**
 * DEC-387 (G4): every event with a pending leftover, oldest-ended first, each
 * carrying the still-held amount. The UI resolves them one at a time (the prompt
 * never auto-decides). Pure.
 */
export function selectPendingEventLeftovers(
  occurrences: PlannedOccurrence[],
  transactions: Transaction[],
  todayIso: string,
): PendingEventLeftover[] {
  return occurrences
    .filter((o) => isEventLeftoverPending(o, transactions, todayIso))
    .map((occurrence) => ({
      occurrence,
      leftoverCents: eventReserveRemainingCents(occurrence, transactions),
    }))
    .sort((a, b) =>
      (a.occurrence.endDate ?? a.occurrence.plannedDate ?? '').localeCompare(
        b.occurrence.endDate ?? b.occurrence.plannedDate ?? '',
      ),
    );
}
