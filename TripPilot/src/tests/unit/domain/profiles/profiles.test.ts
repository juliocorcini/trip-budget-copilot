import { describe, it, expect } from 'vitest';
import { createCustomActivityProfile, createDefaultActivityProfiles } from '@/domain/profiles';

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
