import type { SyncMetadata } from './common';

/** DEC-075: spending rhythm of a phase. null = uniform (legacy behavior). */
export type PhaseRhythmPreset = 'intense' | 'moderate' | 'relaxed' | 'custom';

export interface Phase extends SyncMetadata {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  order: number;
  /** DEC-075: null = uniform daily spending (pre-R2 behavior). */
  rhythmPreset: PhaseRhythmPreset | null;
  /** DEC-075: weekdays 0 (Sun) - 6 (Sat) that are spending peaks. */
  peakDays: number[] | null;
  notes: string | null;
  /**
   * F17: money the traveler KNOWS will arrive during this phase (a reimbursement,
   * a paycheck mid-trip). It feeds ONLY the future-vision preview of the phase —
   * it NEVER enters `calculateFreeToSpend`/`calculateTodayFreeBudget` (ÂNCORA 11),
   * so today's free-to-spend is unaffected. Non-indexed additive field, optional
   * so pre-existing rows/literals stay valid; read it as `?? 0` (backfilled on
   * read by the repository; backup keeps it via `.passthrough()`; ÂNCORA 14 — no
   * migration).
   */
  plannedIncomeCents?: number;
}
