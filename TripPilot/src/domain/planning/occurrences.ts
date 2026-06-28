import type { PlannedOccurrence, OccurrenceKind } from '@/domain/types/planned-occurrence';
import type { Phase } from '@/domain/types/phase';
import { createSyncMetadata } from '@/utils/entity-factory';
import { addDaysIso, localDayOf } from '@/domain/dates';

export interface CreatePlannedOccurrenceInput {
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  name: string;
  plannedDate: string | null;
  endDate: string | null;
  kind: OccurrenceKind;
  estimatedCostCents: number;
  reservedCents: number | null;
  activityProfileId: string | null;
}

/** DEC-072: planned event / sub-destination inside a phase. */
export function createPlannedOccurrence(input: CreatePlannedOccurrenceInput): PlannedOccurrence {
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    phaseId: input.phaseId,
    activityProfileId: input.activityProfileId,
    budgetPoolId: input.budgetPoolId,
    name: input.name,
    plannedDate: input.plannedDate,
    endDate: input.endDate,
    kind: input.kind,
    estimatedCostCents: input.estimatedCostCents,
    reservedCents: input.reservedCents,
    isConfirmed: false,
    linkedTransactionId: null,
    linkedSessionId: null,
    notes: null,
  };
}

/**
 * DEC-386 (G1): does `dayIso` fall inside the occurrence's date interval? The
 * date-only core shared by `isOccurrenceActiveToday` and the event-attribution
 * selector. A single-day occurrence (`endDate === null`) uses `plannedDate` as
 * both ends.
 */
export function isWithinOccurrenceInterval(occ: PlannedOccurrence, dayIso: string): boolean {
  if (occ.plannedDate === null) return false;
  const start = occ.plannedDate.slice(0, 10);
  const end = (occ.endDate ?? occ.plannedDate).slice(0, 10);
  const day = dayIso.slice(0, 10);
  return start <= day && day <= end;
}

/**
 * DEC-072: an occurrence is "active today" when today falls inside its date
 * interval and no outing session has been linked yet (day card rule).
 */
export function isOccurrenceActiveToday(occ: PlannedOccurrence, todayIso: string): boolean {
  if (occ.deletedAt !== null || occ.isConfirmed || occ.linkedSessionId !== null) return false;
  return isWithinOccurrenceInterval(occ, todayIso);
}

/**
 * DEC-386 (G1): the OPEN events a spend on `dayIso` can be attributed to — kind
 * 'event', not deleted, not confirmed/resolved, whose date interval contains the
 * day. Deliberately decoupled from the outing session (Â-ATTRIBUTION): the user
 * attributes manual/AI/Wise spends to the event WITHOUT the active outing, so an
 * event with a live session is still attributable. The QuickAdd selector
 * pre-suggests from this set (date inference) and the user confirms. Sorted
 * chronologically. Pure.
 */
export function selectAttributableEvents(
  occurrences: PlannedOccurrence[],
  dayIso: string,
): PlannedOccurrence[] {
  return occurrences
    .filter(
      (o) =>
        o.deletedAt === null &&
        o.kind === 'event' &&
        !o.isConfirmed &&
        isWithinOccurrenceInterval(o, dayIso),
    )
    .sort((a, b) => dayOf(a.plannedDate ?? '').localeCompare(dayOf(b.plannedDate ?? '')));
}

/** GATE 4 event visibility window — same D-7 rule as pots (master §10.1). */
export const EVENT_VISIBILITY_WINDOW_DAYS = 7;

/** YYYY-MM-DD (a stored date may carry a time component — compare by day). */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * GATE 4 (M4.4 / D8): is an Event relevant enough to surface on the Home right
 * now? Mirrors the Pote rule (`isPotVisibleOnHome`) so events and pots behave
 * identically: an event rises on the Home when its OWNER trecho is active (its
 * date falls inside the active phase) OR when today is within the D-7 window up
 * to its end — so Tomorrowland (Eurotrip) does not pollute the Burgos days but
 * appears as it approaches. Only OPEN events qualify (an event already linked to
 * a session / confirmed is handled by the live outing, not this card).
 */
export function isEventVisibleOnHome(
  occ: PlannedOccurrence,
  activePhase: Phase | null,
  today: string,
  windowDays: number = EVENT_VISIBILITY_WINDOW_DAYS,
): boolean {
  if (occ.deletedAt !== null || occ.kind !== 'event') return false;
  if (occ.isConfirmed || occ.linkedSessionId !== null) return false;
  if (occ.plannedDate === null) return false;

  const startDay = dayOf(occ.plannedDate);
  const endDay = dayOf(occ.endDate ?? occ.plannedDate);
  if (
    activePhase !== null &&
    dayOf(activePhase.startDate) <= startDay &&
    startDay <= dayOf(activePhase.endDate)
  ) {
    return true; // owner trecho is active
  }

  const windowOpens = addDaysIso(startDay, -windowDays);
  const todayDay = dayOf(today);
  return todayDay >= windowOpens && todayDay <= endDay;
}

/**
 * GATE 4 (M4.4): the open events to surface on the Home today (active-owner OR
 * within D-7), in chronological order. Soft-deleted / confirmed / linked events
 * are dropped by `isEventVisibleOnHome`. The "Potes e planejados" section lists
 * every event regardless — this is only the Home heads-up.
 */
export function selectVisibleEvents(
  occurrences: PlannedOccurrence[],
  activePhase: Phase | null,
  today: string,
  windowDays: number = EVENT_VISIBILITY_WINDOW_DAYS,
): PlannedOccurrence[] {
  return occurrences
    .filter((occ) => isEventVisibleOnHome(occ, activePhase, today, windowDays))
    .sort((a, b) => dayOf(a.plannedDate ?? '').localeCompare(dayOf(b.plannedDate ?? '')));
}

/** DEC-072: "Adiar" pushes the whole date interval one day forward. */
export function postponeOccurrence(occ: PlannedOccurrence): PlannedOccurrence {
  const shiftDay = (isoDate: string): string => {
    const date = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  };
  return {
    ...occ,
    plannedDate: occ.plannedDate ? shiftDay(occ.plannedDate) : null,
    endDate: occ.endDate ? shiftDay(occ.endDate) : null,
  };
}

/**
 * DEC-072 (sub-destinations): real spending of a city = transactions of the
 * phase whose date falls inside the occurrence interval.
 */
export function sumSpentInOccurrenceInterval(
  occ: PlannedOccurrence,
  transactions: { date: string; phaseId: string; deletedAt: string | null; type: string; personalCostCents: number | null; amountCents: number }[],
): number {
  if (occ.plannedDate === null) return 0;
  const start = occ.plannedDate.slice(0, 10);
  const end = (occ.endDate ?? occ.plannedDate).slice(0, 10);
  return transactions
    .filter(
      (t) =>
        t.deletedAt === null &&
        t.phaseId === occ.phaseId &&
        (t.type === 'expense' || t.type === 'adjustment') &&
        // BUG-001 (R6-01): project the UTC instant onto the local day.
        localDayOf(t.date) >= start &&
        localDayOf(t.date) <= end,
    )
    .reduce((sum, t) => sum + (t.personalCostCents ?? t.amountCents), 0);
}
