import type { Phase } from '@/domain/types/phase';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import { buildPhaseAllowanceMap, type PhaseAllowanceMap } from './allowance-map';

export interface PhasePreviewInput {
  phase: Phase;
  /**
   * Free-to-spend computed for THIS phase by the caller
   * (`calculateFreeToSpend(...).freeToSpendCents`). Passing it in keeps this
   * module decoupled from the budget layer (no phases → budget dependency).
   */
  phaseFreeCents: number;
  /** F17: planned income the traveler KNOWS will arrive DURING this phase. */
  plannedIncomeCents: number;
  /** Occurrences scoped to this phase (caller filters by phase + not deleted). */
  occurrences: PlannedOccurrence[];
  /** Planned purchases scoped to this phase or trip-wide (and not deleted). */
  plannedPurchases: PlannedPurchase[];
}

export interface PhasePreview {
  /** First day of the phase — the "as if day one" anchor for the projection. */
  startIso: string;
  /** Number of days in the phase (= map.days.length). */
  totalDays: number;
  /** Free-to-spend for the phase BEFORE planned income (clamped ≥ 0). */
  phaseFreeCents: number;
  /** F17 planned income folded into the projection (clamped ≥ 0). */
  plannedIncomeCents: number;
  /** What the projection distributes = phaseFree + plannedIncome. */
  previewBaseCents: number;
  /** Flat average per day = previewBase / totalDays (headline only). */
  avgPerDayCents: number;
  /** Day-by-day calendar — identical shape to the live phase map. */
  map: PhaseAllowanceMap;
}

/**
 * F18 (future vision) + F17 (planned income): project a phase "as if it were day
 * one". It reuses the SAME pure distribution the live hero uses
 * (`buildPhaseAllowanceMap`) but anchored at the phase start with zero spent, so
 * the traveler can see the per-day plan for ANY phase — including future ones —
 * before living it.
 *
 * ÂNCORA 11: planned income feeds ONLY this read-only projection. It is added on
 * top of the phase free-to-spend HERE and NEVER inside `calculateFreeToSpend` /
 * `calculateTodayFreeBudget`, so today's real free-to-spend is unaffected.
 */
export function buildPhasePreview(input: PhasePreviewInput): PhasePreview {
  const { phase, occurrences, plannedPurchases } = input;
  const phaseFreeCents = Math.max(0, Math.round(input.phaseFreeCents));
  const plannedIncomeCents = Math.max(0, Math.round(input.plannedIncomeCents));
  const previewBaseCents = phaseFreeCents + plannedIncomeCents;
  const startIso = phase.startDate.slice(0, 10);

  // Anchor the projection at the phase start with zero spent — the "day one"
  // view. The same rhythm weights and effective-day denominator the live map
  // uses then distribute `previewBaseCents` across every day of the phase.
  const map = buildPhaseAllowanceMap({
    trueFreeCents: previewBaseCents,
    todaySpentCents: 0,
    phase,
    todayIso: startIso,
    occurrences,
    plannedPurchases,
  });

  const totalDays = map.days.length;
  const avgPerDayCents = totalDays > 0 ? Math.round(previewBaseCents / totalDays) : 0;

  return {
    startIso,
    totalDays,
    phaseFreeCents,
    plannedIncomeCents,
    previewBaseCents,
    avgPerDayCents,
    map,
  };
}
