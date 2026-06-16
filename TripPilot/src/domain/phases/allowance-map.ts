import type { Phase } from '@/domain/types/phase';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import {
  calculateEffectiveSpendingDays,
  getDaySpendingWeight,
  isPeakDay,
  parseLocalDate,
  toLocalIsoDay,
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
  /** Dated reserves (events / dated planned buys) landing on this day. */
  planItems: DayPlanItem[];
  planTotalCents: number;
}

export interface PhaseAllowanceMap {
  days: PhaseAllowanceDay[];
  /** Trip-wide planned buys with no date — shown apart so they are not lost. */
  undatedPlanItems: DayPlanItem[];
  undatedPlanTotalCents: number;
  /** The base distributed across days (trueFree + today's spend). */
  baseFreeCents: number;
  /** Largest single-day allowance — for proportional bar scaling (≥ 1). */
  maxAllowanceCents: number;
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
}

/** Effective (remaining) reserve of a planned item; null reserve = track-only. */
function plannedPurchaseReserve(p: PlannedPurchase): number {
  return Math.max(0, p.reservedCents ?? p.estimatedCostCents);
}

function occurrenceReserve(o: PlannedOccurrence): number {
  return Math.max(0, o.reservedCents ?? o.estimatedCostCents);
}

/** Groups dated reserves by their ISO day for O(1) lookup while walking days. */
function indexPlanByDay(
  occurrences: PlannedOccurrence[],
  plannedPurchases: PlannedPurchase[],
): Map<string, DayPlanItem[]> {
  const byDay = new Map<string, DayPlanItem[]>();
  const push = (dateIso: string, item: DayPlanItem) => {
    const day = dateIso.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(item);
    else byDay.set(day, [item]);
  };

  occurrences.forEach((o) => {
    if (!o.plannedDate || o.linkedTransactionId) return;
    const amountCents = occurrenceReserve(o);
    if (amountCents <= 0) return;
    push(o.plannedDate, { id: o.id, name: o.name, amountCents, kind: 'occurrence' });
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

  const baseFreeCents = Math.max(0, trueFreeCents + todaySpentCents);
  const effectiveDays = calculateEffectiveSpendingDays(phase, todayIso);

  const planByDay = indexPlanByDay(occurrences, plannedPurchases);

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

  const start = parseLocalDate(todayIso);
  const end = parseLocalDate(phase.endDate);
  const todayDay = todayIso.slice(0, 10);
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateIso = toLocalIsoDay(cursor);
    const weight = getDaySpendingWeight(phase, dateIso);
    const allowanceCents =
      effectiveDays > 0 ? Math.round((baseFreeCents * weight) / effectiveDays) : 0;
    const isToday = dateIso === todayDay;
    const spentCents = isToday ? todaySpentCents : 0;
    const planItems = planByDay.get(dateIso) ?? [];
    const planTotalCents = planItems.reduce((acc, i) => acc + i.amountCents, 0);

    days.push({
      dateIso,
      weekday: cursor.getDay(),
      isToday,
      isPeakDay: isPeakDay(phase, dateIso),
      weight,
      allowanceCents,
      spentCents,
      freeCents: allowanceCents - spentCents,
      planItems,
      planTotalCents,
    });

    if (allowanceCents > maxAllowanceCents) maxAllowanceCents = allowanceCents;
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    days,
    undatedPlanItems,
    undatedPlanTotalCents,
    baseFreeCents,
    maxAllowanceCents,
  };
}
