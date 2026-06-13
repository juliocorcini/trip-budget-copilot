import type { PhaseRhythmPreset } from './phase';

/**
 * E7 (M21/M22): a reusable trip "mold" — the learned structure (phases) and
 * the cost shape (profiles/typicals) of a past trip, so the next trip can start
 * from real priors instead of cold defaults. Stored as a non-indexed JSON blob
 * inside AppSettings (no Dexie table/migration — ÂNCORA 18). It carries NO ids,
 * tripId, dates, or sync metadata: those are minted fresh when the template is
 * applied to a brand-new trip (DEC-007 / ÂNCORA 12 — applying is explicit).
 */
export interface TemplateProfile {
  name: string;
  category: string;
  iconName: string | null;
  color: string | null;
  typicalValueCents: number;
  safeValueCents: number;
  expectedFrequencyPerPhase: number | null;
  isCustom: boolean;
  defaultTargetCents: number | null;
  defaultCeilingCents: number | null;
  defaultMaxCents: number | null;
  defaultAvgDrinkPriceCents: number | null;
  quickAddValuesCents: number[] | null;
}

export interface TemplatePhase {
  name: string;
  order: number;
  /** Relative length in days — mapped onto the NEW trip's date range on apply. */
  durationDays: number;
  rhythmPreset: PhaseRhythmPreset | null;
  peakDays: number[] | null;
}

export interface TripTemplate {
  id: string;
  name: string;
  createdAt: string;
  baseCurrency: string;
  phases: TemplatePhase[];
  profiles: TemplateProfile[];
}
