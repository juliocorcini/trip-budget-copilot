import { addDaysIso } from '@/domain/dates';
import type { Phase } from '@/domain/types/phase';

/**
 * Inclusive day-range overlap. Dates are 'YYYY-MM-DD', which sort
 * lexicographically, so plain string comparison is a correct calendar compare.
 */
export function phaseRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export interface PhaseRangeCandidate {
  /** Set when editing an existing trecho — excludes itself from the conflict set. */
  id?: string;
  startDate: string;
  endDate: string;
}

/** Live phases (excluding the candidate itself) whose inclusive range overlaps it. */
export function findOverlappingPhases(
  phases: Phase[],
  candidate: PhaseRangeCandidate,
): Phase[] {
  return phases.filter(
    (p) =>
      p.deletedAt === null &&
      p.id !== candidate.id &&
      phaseRangesOverlap(p.startDate, p.endDate, candidate.startDate, candidate.endDate),
  );
}

export interface BoundaryFix {
  /** The earlier trecho to trim. */
  phaseId: string;
  phaseName: string;
  /** Its new end date = the day BEFORE the candidate starts (D13). */
  newEndDate: string;
}

export type PhaseSequenceValidation =
  | { ok: true }
  | { ok: false; reason: 'invalid_range' }
  | { ok: false; reason: 'overlap'; conflicts: Phase[]; boundaryFix: BoundaryFix | null };

/**
 * D12 (phases are always sequential) + D13 (the boundary day belongs to the
 * trecho that STARTS). Validates a candidate trecho range against the existing
 * trechos:
 *  - `invalid_range` when end < start.
 *  - `overlap` listing the conflicting trechos. When the ONLY conflict is a clean
 *    adjacency — a single earlier trecho whose end bleeds into the candidate's
 *    start — we offer a `boundaryFix`: trim that earlier trecho to the day before
 *    the candidate starts, so the starting trecho keeps the boundary day (e.g.
 *    Eurotrip starting 15/07 → Burgos trimmed to 14/07). Deeper or ambiguous
 *    overlaps return `boundaryFix: null`; we never auto-edit something that would
 *    discard part of another trecho.
 */
export function validatePhaseSequence(
  phases: Phase[],
  candidate: PhaseRangeCandidate,
): PhaseSequenceValidation {
  if (candidate.endDate < candidate.startDate) {
    return { ok: false, reason: 'invalid_range' };
  }
  const conflicts = findOverlappingPhases(phases, candidate);
  if (conflicts.length === 0) return { ok: true };
  return {
    ok: false,
    reason: 'overlap',
    conflicts,
    boundaryFix: computeBoundaryFix(conflicts, candidate),
  };
}

function computeBoundaryFix(
  conflicts: Phase[],
  candidate: PhaseRangeCandidate,
): BoundaryFix | null {
  if (conflicts.length !== 1) return null;
  const prev = conflicts[0]!;
  // Auto-fixable only when the earlier trecho purely "bleeds into" the
  // candidate's start: it starts strictly before the candidate, ends within the
  // candidate's range (so trimming it does not discard a tail beyond the new
  // trecho), and trimming to candidate.start - 1 leaves it valid.
  if (prev.startDate >= candidate.startDate) return null;
  if (prev.endDate > candidate.endDate) return null;
  const newEndDate = addDaysIso(candidate.startDate, -1);
  if (newEndDate < prev.startDate) return null;
  return { phaseId: prev.id, phaseName: prev.name, newEndDate };
}
