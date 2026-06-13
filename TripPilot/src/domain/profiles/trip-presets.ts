import type { PhaseRhythmPreset } from '@/domain/types/phase';

/**
 * E1 (M17): trip archetypes that pre-fill plausible onboarding defaults
 * (rhythm, peak days, protected reserve). They are SUGGESTIONS the traveler
 * can adjust — nothing is forced (DEC-007 / ÂNCORA 10). Names are i18n keys
 * (`trip_presets.<id>`). Distinct from ACTIVITY_PROFILE_PRESETS, which seed
 * per-category activity profiles.
 */
export type TripPresetId = 'urban' | 'family' | 'festival';

export interface TripPreset {
  id: TripPresetId;
  iconName: string;
  rhythmPreset: PhaseRhythmPreset;
  /** Weekday numbers (0=Sun … 6=Sat) treated as heavier-spend days. */
  peakDays: number[];
  /** Share of the budget suggested as protected reserve (0..1). */
  reserveRate: number;
}

export const TRIP_PRESETS: TripPreset[] = [
  { id: 'urban', iconName: 'location_city', rhythmPreset: 'moderate', peakDays: [5, 6], reserveRate: 0.1 },
  { id: 'family', iconName: 'family_restroom', rhythmPreset: 'relaxed', peakDays: [0, 6], reserveRate: 0.15 },
  { id: 'festival', iconName: 'celebration', rhythmPreset: 'intense', peakDays: [4, 5, 6], reserveRate: 0.08 },
];

export function findTripPreset(id: TripPresetId): TripPreset | undefined {
  return TRIP_PRESETS.find((preset) => preset.id === id);
}

/**
 * Suggested protected reserve for a budget, in whole cents. Never negative and
 * never larger than the budget itself.
 */
export function calculatePresetReserveCents(
  totalAmountCents: number,
  reserveRate: number,
): number {
  if (totalAmountCents <= 0 || reserveRate <= 0) return 0;
  return Math.min(totalAmountCents, Math.round(totalAmountCents * reserveRate));
}

export interface TripPresetDefaults {
  rhythmPreset: PhaseRhythmPreset;
  peakDays: number[];
  protectedReserveCents: number;
}

/** Maps a preset + budget into the onboarding fields it pre-fills. */
export function applyTripPreset(
  preset: TripPreset,
  totalAmountCents: number,
): TripPresetDefaults {
  return {
    rhythmPreset: preset.rhythmPreset,
    peakDays: preset.peakDays,
    protectedReserveCents: calculatePresetReserveCents(totalAmountCents, preset.reserveRate),
  };
}
