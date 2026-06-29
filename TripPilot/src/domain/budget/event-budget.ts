import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { Session } from '@/domain/types/session';
import { sumCents } from '@/domain/money';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';
import { getTotalDays, localDayOf } from '@/domain/dates';

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
 * DEC-400 (G1): the set of outing sessions that belong to an event — its N
 * outings over time. New outings back-link via `Session.occurrenceId` ("iniciar
 * saída"); the legacy 1:1 `PlannedOccurrence.linkedSessionId` still counts as
 * one of them. A `Set` so a session linked both ways is counted ONCE (no double
 * count). Pure.
 */
export function eventOutingSessionIds(
  occ: PlannedOccurrence,
  sessions: Session[],
): Set<string> {
  const ids = new Set<string>();
  if (occ.linkedSessionId !== null) ids.add(occ.linkedSessionId);
  for (const session of sessions) {
    if (session.occurrenceId === occ.id) ids.add(session.id);
  }
  return ids;
}

/**
 * DEC-385 (G2) / DEC-400 (G1): the spend that CONSUMES an event's reserve. Two
 * disjoint draws on the same reserved money (a spend is event XOR session,
 * Â-ATTRIBUTION): the explicitly attributed spend (`occurrenceId`) PLUS the spend
 * of EVERY outing started from the event (`eventOutingSessionIds` — the legacy
 * `linkedSessionId` and all `Session.occurrenceId` back-links, deduped). Summing
 * every outing is what lets one event own N outings WITHOUT double counting:
 * each outing expense is removed from free once via pool spent and netted here
 * once against the reserve (Â-EVENT-NO-DOUBLE-COUNT). With no sessions passed it
 * falls back to the legacy single link, so existing call sites stay bit-for-bit.
 * Pure.
 */
export function eventConsumedSpentCents(
  occ: PlannedOccurrence,
  transactions: Transaction[],
  sessions: Session[] = [],
): number {
  const attributed = eventAttributedSpent(occ.id, transactions);
  const sessionIds = eventOutingSessionIds(occ, sessions);
  const sessionSpent =
    sessionIds.size === 0
      ? 0
      : liveSpendBaseCostCents(
          transactions,
          (t) => t.sessionId != null && sessionIds.has(t.sessionId),
        );
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
  sessions: Session[] = [],
): number {
  if (occ.reservedCents === null || occ.isConfirmed) return 0;
  return Math.max(0, occ.reservedCents - eventConsumedSpentCents(occ, transactions, sessions));
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
  sessions: Session[] = [],
): number {
  const remaining = eventReserveRemainingCents(occ, transactions, sessions);
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
  /** DEC-401 (G2): the spend's place, for the guide's per-expense mini-map. */
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
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
  /** The legacy single outing linked to this event, if any (DEC-072). */
  linkedSessionId: string | null;
  /**
   * DEC-400/409 (G1): the event's currently RUNNING outing, if any (`status`
   * 'active', via `Session.occurrenceId` or the legacy `linkedSessionId`). The
   * Home embeds this outing INSIDE the event card and suppresses the standalone
   * outing card (no 2nd card); `null` when no outing is running.
   */
  activeSessionId: string | null;
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
  sessions: Session[] = [],
): LiveEventProgress {
  const sessionIds = eventOutingSessionIds(occ, sessions);
  const expenses: LiveEventExpense[] = transactions
    .filter(
      (t) =>
        t.deletedAt === null &&
        (t.type === 'expense' || t.type === 'adjustment') &&
        (t.occurrenceId === occ.id || (t.sessionId != null && sessionIds.has(t.sessionId))),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      category: t.category,
      baseCostCents: transactionBasePersonalCostCents(t),
      source: t.occurrenceId === occ.id ? 'attributed' : 'outing',
      placeLabel: t.placeLabel ?? null,
      latitude: t.latitude ?? null,
      longitude: t.longitude ?? null,
    }));
  const activeSession = sessions.find(
    (s) => s.status === 'active' && s.deletedAt === null && sessionIds.has(s.id),
  );
  return {
    occurrence: occ,
    reservedCents: occ.reservedCents,
    consumedCents: eventConsumedSpentCents(occ, transactions, sessions),
    remainingCents: eventReserveRemainingCents(occ, transactions, sessions),
    perDayCents: eventDailyAllowanceCents(occ, transactions, todayIso, sessions),
    daysLeftInclusive: eventDaysLeftInclusive(occ, todayIso),
    linkedSessionId: occ.linkedSessionId,
    activeSessionId: activeSession?.id ?? null,
    expenses,
  };
}

/**
 * DEC-401 (G2): the factual rhythm verdict of an event — a LIGHT cue derived
 * straight from numbers, never an opinion. `none` when there is nothing to pace
 * (track-only event, or the reserve is spent / the event is over so the per-day
 * allowance is 0). Otherwise: `ease_up` when today's spend already passed the
 * day's allowance, `on_pace` when it is still within it.
 */
export type EventPace = 'none' | 'on_pace' | 'ease_up';

/**
 * DEC-401 (G2): the event GUIDE view-model — everything the dedicated
 * `/event/:id` screen needs, layered on the live progress (consumed/remaining/
 * per-day/days + the contributing spends, now carrying each spend's place for
 * the mini-map). It adds only the two derived numbers the rhythm line needs:
 * today's event spend and the factual pace cue. No new money math — `consumed`,
 * `remaining` and `perDay` come verbatim from `buildLiveEventProgress`, so the
 * guide is bit-for-bit consistent with the Home card (Â-MONEY-INVARIANT). Pure.
 */
export interface EventGuide extends LiveEventProgress {
  /** The event spend dated TODAY (base-currency personal cost). */
  spentTodayCents: number;
  /** The factual rhythm cue vs the per-day allowance. */
  pace: EventPace;
}

/**
 * DEC-401 (G2): build the event guide view-model. Reuses `buildLiveEventProgress`
 * (same union, same `consumedCents`) and derives the rhythm inputs: today's event
 * spend (the contributing spends dated today) and a factual pace cue measured
 * against `perDayCents` (the SAME per-day ruler the Home shows). Pure (TS only).
 */
export function buildEventGuide(
  occ: PlannedOccurrence,
  transactions: Transaction[],
  todayIso: string,
  sessions: Session[] = [],
): EventGuide {
  const progress = buildLiveEventProgress(occ, transactions, todayIso, sessions);
  const today = todayIso.slice(0, 10);
  const spentTodayCents = sumCents(
    progress.expenses.filter((e) => localDayOf(e.date) === today).map((e) => e.baseCostCents),
  );
  const pace: EventPace =
    progress.reservedCents === null || progress.perDayCents <= 0
      ? 'none'
      : spentTodayCents > progress.perDayCents
        ? 'ease_up'
        : 'on_pace';
  return { ...progress, spentTodayCents, pace };
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
 * DEC-387 (G4) / DEC-400 (G1): an event has a PENDING leftover when it is "over"
 * and its consumable reserve still holds money (`remaining > 0`) the user has not
 * resolved (`isConfirmed` false — set true once resolved). "Over" now respects
 * the explicit lifecycle: an event that was STARTED stays live until explicitly
 * ENDED, so it is "over" only when `endedAt` is set — it is NEVER auto-prompted
 * by its date passing (the live card's "encerrar evento" drives it,
 * Â-EVENT-LIFECYCLE). An event that was never explicitly started keeps the
 * baseline behaviour: its date interval elapsing makes it over (legacy rows read
 * `startedAt`/`endedAt` undefined ≡ null, so this is bit-for-bit the old prompt).
 * The money is never auto-decided: it stays held (out of free) until the user
 * picks a destination (Â-LEFTOVER-CONSERVED, A4). Pure.
 */
export function isEventLeftoverPending(
  occ: PlannedOccurrence,
  transactions: Transaction[],
  todayIso: string,
  sessions: Session[] = [],
): boolean {
  if (occ.kind !== 'event' || occ.deletedAt !== null) return false;
  const isOver =
    occ.endedAt != null || (occ.startedAt == null && eventHasEnded(occ, todayIso));
  if (!isOver) return false;
  return eventReserveRemainingCents(occ, transactions, sessions) > 0;
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
  sessions: Session[] = [],
): PendingEventLeftover[] {
  return occurrences
    .filter((o) => isEventLeftoverPending(o, transactions, todayIso, sessions))
    .map((occurrence) => ({
      occurrence,
      leftoverCents: eventReserveRemainingCents(occurrence, transactions, sessions),
    }))
    .sort((a, b) =>
      (a.occurrence.endDate ?? a.occurrence.plannedDate ?? '').localeCompare(
        b.occurrence.endDate ?? b.occurrence.plannedDate ?? '',
      ),
    );
}
