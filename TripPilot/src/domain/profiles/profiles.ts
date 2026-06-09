import type { ActivityProfile } from '@/domain/types/activity-profile';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface CreateCustomProfileInput {
  tripId: string;
  name: string;
  iconName: string | null;
  typicalValueCents: number;
  category?: string;
}

/** Session limits derived from the typical value for custom profiles. */
const CEILING_MULTIPLIER = 1.3;
const MAX_MULTIPLIER = 1.6;

/**
 * Standard profile presets created for every new trip (DEC-037).
 * Names are pt-BR data values, mirroring the demo dataset.
 */
const DEFAULT_PROFILE_PRESETS = [
  {
    name: 'Bar',
    category: 'bar',
    iconName: 'local_bar',
    color: '#C75B39',
    typicalValueCents: 1500,
    safeValueCents: 2000,
    expectedFrequencyPerPhase: 5,
    defaultTargetCents: 1500,
    defaultCeilingCents: 2500,
    defaultMaxCents: 3500,
    defaultAvgDrinkPriceCents: 350,
  },
  {
    name: 'Restaurante',
    category: 'restaurant',
    iconName: 'restaurant',
    color: '#D4A843',
    typicalValueCents: 1200,
    safeValueCents: 1800,
    expectedFrequencyPerPhase: 4,
    defaultTargetCents: null,
    defaultCeilingCents: null,
    defaultMaxCents: null,
    defaultAvgDrinkPriceCents: null,
  },
  {
    name: 'Mercado',
    category: 'market',
    iconName: 'shopping_cart',
    color: '#6B8F71',
    typicalValueCents: 2500,
    safeValueCents: 3500,
    expectedFrequencyPerPhase: 3,
    defaultTargetCents: null,
    defaultCeilingCents: null,
    defaultMaxCents: null,
    defaultAvgDrinkPriceCents: null,
  },
] as const;

export function createDefaultActivityProfiles(tripId: string): ActivityProfile[] {
  return DEFAULT_PROFILE_PRESETS.map((preset) => ({
    ...createSyncMetadata(),
    tripId,
    name: preset.name,
    category: preset.category,
    iconName: preset.iconName,
    color: preset.color,
    typicalValueCents: preset.typicalValueCents,
    safeValueCents: preset.safeValueCents,
    confidence: 'low',
    dataPointCount: 0,
    expectedFrequencyPerPhase: preset.expectedFrequencyPerPhase,
    isCustom: false,
    defaultTargetCents: preset.defaultTargetCents,
    defaultCeilingCents: preset.defaultCeilingCents,
    defaultMaxCents: preset.defaultMaxCents,
    defaultAvgDrinkPriceCents: preset.defaultAvgDrinkPriceCents,
    quickAddValuesCents: null,
    notes: null,
  }));
}

export function createCustomActivityProfile(input: CreateCustomProfileInput): ActivityProfile {
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    name: input.name,
    category: input.category ?? 'other',
    iconName: input.iconName,
    color: null,
    typicalValueCents: input.typicalValueCents,
    safeValueCents: input.typicalValueCents,
    confidence: 'low',
    dataPointCount: 0,
    expectedFrequencyPerPhase: 1,
    isCustom: true,
    defaultTargetCents: input.typicalValueCents,
    defaultCeilingCents: Math.round(input.typicalValueCents * CEILING_MULTIPLIER),
    defaultMaxCents: Math.round(input.typicalValueCents * MAX_MULTIPLIER),
    defaultAvgDrinkPriceCents: null,
    quickAddValuesCents: null,
    notes: null,
  };
}
