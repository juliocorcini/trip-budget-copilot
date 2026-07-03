import type { Phase } from '@/domain/types/phase';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { Transaction } from '@/domain/types/transaction';
import { eventReserveRemainingCents } from '@/domain/budget/event-budget';
import {
  calculateEffectiveSpendingDays,
  getBaseDayWeight,
  getDaySpendingWeight,
  isPeakDay,
  parseLocalDate,
  phaseHasRhythm,
  toLocalIsoDay,
  type TodayFreeBudgetPiggyCap,
} from './rhythm';

/**
 * FIELD-19 (Julio field feedback): a per-day allowance "map" for the active
 * phase. The hero only shows a single "free today" number; the user could not
 * tell whether €3.96 today meant the whole trip was tight or just that today is
 * a low-rhythm weekday. This projects the SAME math the hero uses
 * (calculateTodayFreeBudget) across every remaining day so the distribution is
 * visible: weekdays low, peak weekend days higher, plus the dated reserves that
 * already left the free pool.
 *
 * Consistency guarantee: today's `allowanceCents`/`freeCents` here equal
 * `calculateTodayFreeBudget(...).todayAllowanceCents`/`.freeTodayCents` because
 * both distribute the same start-of-day base (trueFree + today's spend) by the
 * same rhythm weights over the same effective-day denominator.
 */

export type DayPlanItemKind = 'occurrence' | 'purchase';

export interface DayPlanItem {
  id: string;
  name: string;
  amountCents: number;
  kind: DayPlanItemKind;
}

export interface PhaseAllowanceDay {
  dateIso: string;
  /** 0 (Sun) .. 6 (Sat) — local weekday, for short labels. */
  weekday: number;
  isToday: boolean;
  isPeakDay: boolean;
  weight: number;
  /** Weighted share of the day at start-of-day (before that day's spend). */
  allowanceCents: number;
  /** Money already spent that day (only known for today; 0 for the future). */
  spentCents: number;
  /** allowance − spent. Can be negative when today is already overspent. */
  freeCents: number;
  /**
   * DEC-427 (Field v2): for TODAY, how much the cofrinho cap parked away
   * (raw share − capped allowance); 0 on every other day and when no cap is
   * active. The day-detail explainer shows it as "guardado no cofrinho: €X".
   */
  piggyParkedCents: number;
  /** Dated reserves (events / dated planned buys) landing on this day. */
  planItems: DayPlanItem[];
  planTotalCents: number;
  /**
   * F20: the total amount moving through the day = free + reserved
   * ("€63 free + €60 cream = €123"). The reserve already left `trueFree` once,
   * so layering it back here is a DISPLAY total only — it never re-enters the
   * budget and `freeCents` stays equal to the hero's free-today.
   */
  dayTotalCents: number;
}

export interface PhaseAllowanceMap {
  days: PhaseAllowanceDay[];
  /** Trip-wide planned buys with no date — shown apart so they are not lost. */
  undatedPlanItems: DayPlanItem[];
  undatedPlanTotalCents: number;
  /** The base distributed across days (trueFree + today's spend). */
  baseFreeCents: number;
  /**
   * GATE 19: allowance of a "common" (non-peak, base-weight) day — the reference
   * the day-detail explainer compares peak days against ("peak days get more
   * than a regular ~€X day"). Equals `maxAllowanceCents` when there is no peak.
   */
  normalAllowanceCents: number;
  /** GATE 19: whether the phase distributes money unevenly (rhythm or peak days). */
  hasRhythm: boolean;
  /** Largest single-day allowance — for proportional bar scaling (≥ 1). */
  maxAllowanceCents: number;
  /** Largest single-day total (free + reserved) — for calendar intensity (≥ 1). */
  maxDayTotalCents: number;
}

export interface BuildPhaseAllowanceMapInput {
  /** Remaining truly-free money for the whole phase (already net of spend). */
  trueFreeCents: number;
  /** Spent so far TODAY in the primary pool. */
  todaySpentCents: number;
  phase: Phase;
  todayIso: string;
  /** Occurrences already scoped to this phase (and not deleted). */
  occurrences: PlannedOccurrence[];
  /** Planned purchases scoped to this phase or trip-wide (and not deleted). */
  plannedPurchases: PlannedPurchase[];
  /**
   * DEC-391: trip transactions, so a reserved EVENT shows its CONSUMABLE reserve
   * (held − spent) per remaining day, not the full reserve. Defaults to none.
   */
  transactions?: Transaction[];
  /**
   * DEC-427 (Field v2): the SAME cofrinho cap the hero uses
   * (`calculateTodayFreeBudget`). When present with a positive balance, TODAY's
   * cell is capped at the day's ideal-base (min only) so "livre no dia" here
   * equals the Home hero's "livre para usar hoje" — the 5-vs-14 bug was this map
   * showing the UNcapped share while the hero capped it. Future days stay raw
   * (a projection). Money-invariant: the total free is untouched; only today's
   * READING is capped and the difference is exactly what the cofrinho holds.
   */
  piggyCap?: TodayFreeBudgetPiggyCap;
}

/** Effective (remaining) reserve of a planned item; null reserve = track-only. */
function plannedPurchaseReserve(p: PlannedPurchase): number {
  return Math.max(0, p.reservedCents ?? p.estimatedCostCents);
}

function occurrenceReserve(o: PlannedOccurrence): number {
  return Math.max(0, o.reservedCents ?? o.estimatedCostCents);
}

/**
 * The local ISO days a dated occurrence spans, inclusive. A single-day event
 * (no `endDate`, or one not after the start) is just its `plannedDate`.
 */
function occurrenceSpanDays(plannedDate: string, endDate: string | null): string[] {
  const start = parseLocalDate(plannedDate);
  const end = parseLocalDate((endDate ?? plannedDate));
  if (end <= start) return [toLocalIsoDay(start)];
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(toLocalIsoDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Spreads `amountCents` evenly across `days`, the remainder riding the last day. */
function spreadOverDays(
  days: string[],
  amountCents: number,
  item: Omit<DayPlanItem, 'amountCents'>,
  push: (dateIso: string, item: DayPlanItem) => void,
): void {
  if (days.length === 0 || amountCents <= 0) return;
  const perDayCents = Math.floor(amountCents / days.length);
  days.forEach((day, i) => {
    const shareCents =
      i === days.length - 1 ? amountCents - perDayCents * (days.length - 1) : perDayCents;
    if (shareCents > 0) push(day, { ...item, amountCents: shareCents });
  });
}

/** Groups dated reserves by their ISO day for O(1) lookup while walking days. */
function indexPlanByDay(
  occurrences: PlannedOccurrence[],
  plannedPurchases: PlannedPurchase[],
  transactions: Transaction[],
  todayIso: string,
): Map<string, DayPlanItem[]> {
  const byDay = new Map<string, DayPlanItem[]>();
  const today = todayIso.slice(0, 10);
  const push = (dateIso: string, item: DayPlanItem) => {
    const day = dateIso.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(item);
    else byDay.set(day, [item]);
  };

  occurrences.forEach((o) => {
    if (!o.plannedDate || o.linkedTransactionId) return;

    // DEC-391 (parte 2, G2): a reserved EVENT shows its CONSUMABLE reserve in the
    // day detail — what is STILL held (reserve − spend attributed to it, DEC-385)
    // split over the days it still spans FROM today — instead of dumping the full
    // reserve flat across every day. This matches the day-card and recomputes as
    // money is spent. Past days are dropped (the map only walks today→end anyway).
    if (o.kind === 'event' && o.reservedCents !== null) {
      const remainingCents = eventReserveRemainingCents(o, transactions);
      if (remainingCents <= 0) return;
      const remainingDays = occurrenceSpanDays(o.plannedDate, o.endDate).filter((d) => d >= today);
      spreadOverDays(remainingDays, remainingCents, { id: o.id, name: o.name, kind: 'occurrence' }, push);
      return;
    }

    // Julio field feedback: a MULTI-DAY sub-destination (e.g. 26→30 with €100
    // reserved) spreads its reserve evenly across each of its days, so "available
    // per day" shows the daily average (€20/day) instead of dumping the whole €100
    // on the start day. Integer-cents: the remainder rides the last day so the
    // parts sum back to the exact reserve. Single-day items are unchanged.
    const amountCents = occurrenceReserve(o);
    if (amountCents <= 0) return;
    const span = occurrenceSpanDays(o.plannedDate, o.endDate);
    spreadOverDays(span, amountCents, { id: o.id, name: o.name, kind: 'occurrence' }, push);
  });

  plannedPurchases.forEach((p) => {
    if (p.status !== 'planned' || !p.targetDate) return;
    const amountCents = plannedPurchaseReserve(p);
    if (amountCents <= 0) return;
    push(p.targetDate, { id: p.id, name: p.name, amountCents, kind: 'purchase' });
  });

  return byDay;
}

export function buildPhaseAllowanceMap(input: BuildPhaseAllowanceMapInput): PhaseAllowanceMap {
  const { trueFreeCents, todaySpentCents, phase, todayIso, occurrences, plannedPurchases } = input;
  const transactions = input.transactions ?? [];
  const piggyCap = input.piggyCap;
  // DEC-427: mirror `calculateTodayFreeBudget`'s cap gate exactly — only when the
  // cofrinho actually holds a positive balance and there is an ideal-base ceiling.
  const capActive =
    piggyCap !== undefined && piggyCap.balanceCents > 0 && piggyCap.baseDailyIdealCents > 0;

  const baseFreeCents = Math.max(0, trueFreeCents + todaySpentCents);
  const effectiveDays = calculateEffectiveSpendingDays(phase, todayIso);
  const hasRhythm = phaseHasRhythm(phase);
  const normalAllowanceCents =
    effectiveDays > 0
      ? Math.round((baseFreeCents * getBaseDayWeight(phase)) / effectiveDays)
      : 0;

  const planByDay = indexPlanByDay(occurrences, plannedPurchases, transactions, todayIso);

  const undatedPlanItems: DayPlanItem[] = plannedPurchases
    .filter((p) => p.status === 'planned' && !p.targetDate && plannedPurchaseReserve(p) > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      amountCents: plannedPurchaseReserve(p),
      kind: 'purchase' as const,
    }));
  const undatedPlanTotalCents = undatedPlanItems.reduce((acc, i) => acc + i.amountCents, 0);

  const days: PhaseAllowanceDay[] = [];
  let maxAllowanceCents = 1;
  let maxDayTotalCents = 1;

  const start = parseLocalDate(todayIso);
  const end = parseLocalDate(phase.endDate);
  const todayDay = todayIso.slice(0, 10);
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateIso = toLocalIsoDay(cursor);
    const weight = getDaySpendingWeight(phase, dateIso);
    const rawAllowanceCents =
      effectiveDays > 0 ? Math.round((baseFreeCents * weight) / effectiveDays) : 0;
    const isToday = dateIso === todayDay;
    // DEC-427: cap TODAY at the ideal-base when the cofrinho is holding the parked
    // leftover — the SAME `min` the hero applies — so the by-day screen matches the
    // Home. Future days keep the raw projection; the parked difference is surfaced.
    const allowanceCents =
      isToday && capActive
        ? Math.min(rawAllowanceCents, piggyCap!.baseDailyIdealCents)
        : rawAllowanceCents;
    const piggyParkedCents = isToday && capActive ? rawAllowanceCents - allowanceCents : 0;
    const spentCents = isToday ? todaySpentCents : 0;
    const planItems = planByDay.get(dateIso) ?? [];
    const planTotalCents = planItems.reduce((acc, i) => acc + i.amountCents, 0);
    const freeCents = allowanceCents - spentCents;
    const dayTotalCents = freeCents + planTotalCents;

    days.push({
      dateIso,
      weekday: cursor.getDay(),
      isToday,
      isPeakDay: isPeakDay(phase, dateIso),
      weight,
      allowanceCents,
      spentCents,
      freeCents,
      piggyParkedCents,
      planItems,
      planTotalCents,
      dayTotalCents,
    });

    if (allowanceCents > maxAllowanceCents) maxAllowanceCents = allowanceCents;
    if (dayTotalCents > maxDayTotalCents) maxDayTotalCents = dayTotalCents;
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    days,
    undatedPlanItems,
    undatedPlanTotalCents,
    baseFreeCents,
    normalAllowanceCents,
    hasRhythm,
    maxAllowanceCents,
    maxDayTotalCents,
  };
}
