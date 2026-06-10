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
}
