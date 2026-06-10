import { describe, it, expect } from 'vitest';
import {
  createCustomActivityProfile,
  createDefaultActivityProfiles,
  createPhaseProfileSetting,
  isProfileEnabledInPhase,
  ACTIVITY_PROFILE_PRESETS,
  findProfileForPreset,
  createProfileFromPreset,
} from '@/domain/profiles';

describe('createCustomActivityProfile', () => {
  it('creates a custom profile with given name, icon and typical value', () => {
    const profile = createCustomActivityProfile({
      tripId: 'trip-1',
      name: 'Lavanderia',
      iconName: 'local_laundry_service',
      typicalValueCents: 800,
    });

    expect(profile.tripId).toBe('trip-1');
    expect(profile.name).toBe('Lavanderia');
    expect(profile.iconName).toBe('local_laundry_service');
    expect(profile.typicalValueCents).toBe(800);
    expect(profile.isCustom).toBe(true);
    expect(profile.deletedAt).toBeNull();
  });
});

describe('createDefaultActivityProfiles', () => {
  it('creates the three standard profiles (bar, restaurant, market)', () => {
    const profiles = createDefaultActivityProfiles('trip-1');

    expect(profiles).toHaveLength(3);
    expect(profiles.map((p) => p.category)).toEqual(['bar', 'restaurant', 'market']);
    expect(profiles.every((p) => p.tripId === 'trip-1')).toBe(true);
    expect(profiles.every((p) => !p.isCustom)).toBe(true);
    expect(profiles.every((p) => p.deletedAt === null)).toBe(true);
  });

  it('uses integer cents for all monetary values', () => {
    const profiles = createDefaultActivityProfiles('trip-1');

    for (const p of profiles) {
      expect(Number.isInteger(p.typicalValueCents)).toBe(true);
      expect(p.typicalValueCents).toBeGreaterThan(0);
      if (p.safeValueCents !== null) {
        expect(Number.isInteger(p.safeValueCents)).toBe(true);
      }
    }
  });

  it('gives the bar profile drink-specific defaults', () => {
    const [bar] = createDefaultActivityProfiles('trip-1');

    expect(bar!.iconName).toBe('local_bar');
    expect(bar!.defaultAvgDrinkPriceCents).toBe(350);
    expect(bar!.defaultTargetCents).toBe(1500);
  });
});

describe('activity profile presets catalog (DEC-074 / FIELD-01)', () => {
  it('offers 16 presets with unique ids and categories, all in integer cents', () => {
    expect(ACTIVITY_PROFILE_PRESETS).toHaveLength(16);
    expect(new Set(ACTIVITY_PROFILE_PRESETS.map((p) => p.id)).size).toBe(16);
    expect(new Set(ACTIVITY_PROFILE_PRESETS.map((p) => p.category)).size).toBe(16);
    for (const preset of ACTIVITY_PROFILE_PRESETS) {
      expect(Number.isInteger(preset.typicalValueCents)).toBe(true);
      expect(preset.typicalValueCents).toBeGreaterThan(0);
      expect(preset.iconName.length).toBeGreaterThan(0);
    }
  });

  it('matches existing trip profiles by category (no duplicates on tap)', () => {
    const tripProfiles = createDefaultActivityProfiles('trip-1');
    const restaurantPreset = ACTIVITY_PROFILE_PRESETS.find((p) => p.id === 'restaurants')!;
    const beachPreset = ACTIVITY_PROFILE_PRESETS.find((p) => p.id === 'beach')!;

    expect(findProfileForPreset(tripProfiles, restaurantPreset)?.category).toBe('restaurant');
    expect(findProfileForPreset(tripProfiles, beachPreset)).toBeUndefined();
  });

  it('instantiates a profile from a preset with localized name and limits', () => {
    const preset = ACTIVITY_PROFILE_PRESETS.find((p) => p.id === 'beach')!;
    const profile = createProfileFromPreset('trip-1', preset, 'Praia');

    expect(profile.name).toBe('Praia');
    expect(profile.category).toBe('beach');
    expect(profile.iconName).toBe('beach_access');
    expect(profile.typicalValueCents).toBe(1500);
    expect(profile.defaultCeilingCents).toBe(Math.round(1500 * 1.3));
    expect(profile.isCustom).toBe(false);
  });
});

describe('isProfileEnabledInPhase (DEC-074 permissive default)', () => {
  it('treats absence of a setting as enabled', () => {
    expect(isProfileEnabledInPhase([], 'ph-1', 'prof-1')).toBe(true);
  });

  it('respects explicit disable and ignores other phases', () => {
    const disabled = createPhaseProfileSetting('ph-1', 'prof-1', false);
    expect(isProfileEnabledInPhase([disabled], 'ph-1', 'prof-1')).toBe(false);
    expect(isProfileEnabledInPhase([disabled], 'ph-2', 'prof-1')).toBe(true);
  });
});
