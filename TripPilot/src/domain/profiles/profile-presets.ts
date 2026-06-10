import type { ActivityProfile } from '@/domain/types/activity-profile';
import { createSyncMetadata } from '@/utils/entity-factory';

/**
 * DEC-074 (FIELD-01, Julio's adjustment): data-driven catalog of popular
 * travel activity presets. Selecting a preset chip in a phase creates the
 * trip's ActivityProfile on demand (if absent) plus an enabled
 * phaseProfileSetting. Names are i18n keys (`profile_presets.<id>`);
 * typical values are sensible EUR defaults.
 */
export interface ActivityProfilePreset {
  id: string;
  /** Matches ActivityProfile.category — also the dedup key per trip. */
  category: string;
  iconName: string;
  typicalValueCents: number;
  safeValueCents: number;
  expectedFrequencyPerPhase: number;
}

export const ACTIVITY_PROFILE_PRESETS: ActivityProfilePreset[] = [
  { id: 'restaurants', category: 'restaurant', iconName: 'restaurant', typicalValueCents: 1200, safeValueCents: 1800, expectedFrequencyPerPhase: 4 },
  { id: 'bar', category: 'bar', iconName: 'local_bar', typicalValueCents: 1500, safeValueCents: 2000, expectedFrequencyPerPhase: 5 },
  { id: 'market', category: 'market', iconName: 'shopping_cart', typicalValueCents: 2500, safeValueCents: 3500, expectedFrequencyPerPhase: 3 },
  { id: 'transport', category: 'transport', iconName: 'directions_bus', typicalValueCents: 800, safeValueCents: 1200, expectedFrequencyPerPhase: 4 },
  { id: 'accommodation', category: 'accommodation', iconName: 'hotel', typicalValueCents: 6000, safeValueCents: 8000, expectedFrequencyPerPhase: 1 },
  { id: 'cafe_bakery', category: 'cafe', iconName: 'bakery_dining', typicalValueCents: 600, safeValueCents: 900, expectedFrequencyPerPhase: 5 },
  { id: 'tours', category: 'tours', iconName: 'explore', typicalValueCents: 2500, safeValueCents: 3500, expectedFrequencyPerPhase: 2 },
  { id: 'museums', category: 'museums', iconName: 'museum', typicalValueCents: 1200, safeValueCents: 1800, expectedFrequencyPerPhase: 2 },
  { id: 'nightlife', category: 'nightlife', iconName: 'nightlife', typicalValueCents: 2500, safeValueCents: 3500, expectedFrequencyPerPhase: 2 },
  { id: 'beach', category: 'beach', iconName: 'beach_access', typicalValueCents: 1500, safeValueCents: 2200, expectedFrequencyPerPhase: 2 },
  { id: 'shopping', category: 'shopping', iconName: 'shopping_bag', typicalValueCents: 2000, safeValueCents: 3000, expectedFrequencyPerPhase: 2 },
  { id: 'festivals', category: 'festival', iconName: 'celebration', typicalValueCents: 3000, safeValueCents: 4500, expectedFrequencyPerPhase: 1 },
  { id: 'sports', category: 'sports', iconName: 'hiking', typicalValueCents: 2500, safeValueCents: 3500, expectedFrequencyPerPhase: 1 },
  { id: 'laundry', category: 'laundry', iconName: 'local_laundry_service', typicalValueCents: 800, safeValueCents: 1200, expectedFrequencyPerPhase: 1 },
  { id: 'internet_sim', category: 'communication', iconName: 'sim_card', typicalValueCents: 1500, safeValueCents: 2500, expectedFrequencyPerPhase: 1 },
  { id: 'pharmacy', category: 'health', iconName: 'medication', typicalValueCents: 1000, safeValueCents: 1500, expectedFrequencyPerPhase: 1 },
];

/** Finds the trip profile matching a preset (by category — dedup rule). */
export function findProfileForPreset(
  profiles: ActivityProfile[],
  preset: ActivityProfilePreset,
): ActivityProfile | undefined {
  return profiles.find((p) => p.category === preset.category && p.deletedAt === null);
}

const CEILING_MULTIPLIER = 1.3;
const MAX_MULTIPLIER = 1.6;

/** Instantiates the trip ActivityProfile for a preset (localized name). */
export function createProfileFromPreset(
  tripId: string,
  preset: ActivityProfilePreset,
  localizedName: string,
): ActivityProfile {
  return {
    ...createSyncMetadata(),
    tripId,
    name: localizedName,
    category: preset.category,
    iconName: preset.iconName,
    color: null,
    typicalValueCents: preset.typicalValueCents,
    safeValueCents: preset.safeValueCents,
    confidence: 'low',
    dataPointCount: 0,
    expectedFrequencyPerPhase: preset.expectedFrequencyPerPhase,
    isCustom: false,
    defaultTargetCents: preset.typicalValueCents,
    defaultCeilingCents: Math.round(preset.typicalValueCents * CEILING_MULTIPLIER),
    defaultMaxCents: Math.round(preset.typicalValueCents * MAX_MULTIPLIER),
    defaultAvgDrinkPriceCents: preset.category === 'bar' ? 350 : null,
    quickAddValuesCents: null,
    notes: null,
  };
}
