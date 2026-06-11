import type { PlannedOccurrence, OccurrenceKind } from '@/domain/types/planned-occurrence';
import { createSyncMetadata } from '@/utils/entity-factory';
import { localDayOf } from '@/domain/dates';

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
 * DEC-072: an occurrence is "active today" when today falls inside its date
 * interval and no outing session has been linked yet (day card rule).
 */
export function isOccurrenceActiveToday(occ: PlannedOccurrence, todayIso: string): boolean {
  if (occ.deletedAt !== null || occ.isConfirmed || occ.linkedSessionId !== null) return false;
  if (occ.plannedDate === null) return false;
  const start = occ.plannedDate.slice(0, 10);
  const end = (occ.endDate ?? occ.plannedDate).slice(0, 10);
  const today = todayIso.slice(0, 10);
  return start <= today && today <= end;
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
