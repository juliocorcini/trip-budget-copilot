import type { PlannedOccurrence, OccurrenceKind } from '@/domain/types/planned-occurrence';
import { createSyncMetadata } from '@/utils/entity-factory';

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
