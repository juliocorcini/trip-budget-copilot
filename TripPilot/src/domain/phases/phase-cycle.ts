import type { Phase } from '@/domain/types/phase';
import { sortPhasesByOrder } from '@/domain/dates';

/**
 * E5 (M9) — phase cycle: detecting when a phase closes with money left so the
 * traveler can decide what to do with it (carry over / reserve / release).
 * Pure, side-effect free — the model feeds in the computed leftover and the
 * "already handled" list; this layer only decides whether to surface a sheet.
 */

export interface EndedPhaseTransition {
  ended: Phase;
  next: Phase;
}

/**
 * The most recent phase that has already ENDED while its following phase is
 * still live (current or future) — i.e. a real inter-phase boundary to settle.
 * Returns null when no phase has ended yet, when the trip has a single phase,
 * or when the trip is fully over (no live successor). End dates compare by
 * local calendar day so the whole end day still counts as active (BUG-002).
 */
export function findEndedPhaseWithSuccessor(
  phases: Phase[],
  todayIso: string,
): EndedPhaseTransition | null {
  const sorted = sortPhasesByOrder(phases.filter((p) => p.deletedAt === null));
  if (sorted.length < 2) return null;

  let transition: EndedPhaseTransition | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const ended = sorted[i]!;
    const next = sorted[i + 1]!;
    const hasEnded = ended.endDate.slice(0, 10) < todayIso;
    const nextStillLive = next.endDate.slice(0, 10) >= todayIso;
    if (hasEnded && nextStillLive) transition = { ended, next };
  }
  return transition;
}

export interface PhaseLeftover {
  endedPhaseId: string;
  endedPhaseName: string;
  nextPhaseId: string;
  nextPhaseName: string;
  leftoverCents: number;
}

export interface DetectPhaseLeftoverInput {
  phases: Phase[];
  todayIso: string;
  /** Free-to-spend money carried into the next phase (computed by the caller). */
  leftoverCents: number;
  /** settings.phaseLeftoverHandled — ended phases already settled/dismissed. */
  handledPhaseIds: string[];
}

/**
 * The decision prompt for a just-ended phase: shown ONCE per ended phase, only
 * when there is a positive leftover and it has not been handled yet. Anti-spam
 * (ÂNCORA 8) and "dismiss does not repeat in the same cycle" (M9 DONE) both
 * come from the handled list.
 */
export function detectPhaseLeftover(input: DetectPhaseLeftoverInput): PhaseLeftover | null {
  if (input.leftoverCents <= 0) return null;
  const transition = findEndedPhaseWithSuccessor(input.phases, input.todayIso);
  if (!transition) return null;
  if (input.handledPhaseIds.includes(transition.ended.id)) return null;

  return {
    endedPhaseId: transition.ended.id,
    endedPhaseName: transition.ended.name,
    nextPhaseId: transition.next.id,
    nextPhaseName: transition.next.name,
    leftoverCents: input.leftoverCents,
  };
}

/** Append an ended-phase id to the handled list (idempotent). */
export function markPhaseLeftoverHandled(handled: string[], phaseId: string): string[] {
  return handled.includes(phaseId) ? handled : [...handled, phaseId];
}
