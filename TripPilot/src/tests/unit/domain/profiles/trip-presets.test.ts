import { describe, it, expect } from 'vitest';
import {
  TRIP_PRESETS,
  findTripPreset,
  calculatePresetReserveCents,
  applyTripPreset,
} from '@/domain/profiles';

describe('trip presets (E1 / M17)', () => {
  it('exposes the three archetypes', () => {
    expect(TRIP_PRESETS.map((p) => p.id)).toEqual(['urban', 'family', 'festival']);
  });

  it('finds a preset by id, undefined when absent', () => {
    expect(findTripPreset('family')?.rhythmPreset).toBe('relaxed');
    // @ts-expect-error — guarding the runtime path for an unknown id.
    expect(findTripPreset('space-cruise')).toBeUndefined();
  });

  describe('calculatePresetReserveCents', () => {
    it('takes the configured share of the budget, rounded to cents', () => {
      // €1.000,00 × 10% = €100,00.
      expect(calculatePresetReserveCents(100_000, 0.1)).toBe(10_000);
    });

    it('rounds to the nearest cent', () => {
      // 999 × 0.08 = 79.92 → 80.
      expect(calculatePresetReserveCents(999, 0.08)).toBe(80);
    });

    it('is zero for a non-positive budget or rate', () => {
      expect(calculatePresetReserveCents(0, 0.1)).toBe(0);
      expect(calculatePresetReserveCents(100_000, 0)).toBe(0);
    });

    it('never exceeds the budget itself', () => {
      expect(calculatePresetReserveCents(100, 2)).toBe(100);
    });
  });

  describe('applyTripPreset', () => {
    it('urban → moderate pace, weekend peaks, 10% reserve', () => {
      const preset = findTripPreset('urban')!;
      const defaults = applyTripPreset(preset, 100_000);
      expect(defaults.rhythmPreset).toBe('moderate');
      expect(defaults.peakDays).toEqual([5, 6]);
      expect(defaults.protectedReserveCents).toBe(10_000);
    });

    it('festival → intense pace, Thu-Sat peaks, 8% reserve', () => {
      const preset = findTripPreset('festival')!;
      const defaults = applyTripPreset(preset, 50_000);
      expect(defaults.rhythmPreset).toBe('intense');
      expect(defaults.peakDays).toEqual([4, 5, 6]);
      expect(defaults.protectedReserveCents).toBe(4_000);
    });

    it('family → relaxed pace, 15% reserve', () => {
      const preset = findTripPreset('family')!;
      const defaults = applyTripPreset(preset, 200_000);
      expect(defaults.rhythmPreset).toBe('relaxed');
      expect(defaults.protectedReserveCents).toBe(30_000);
    });
  });
});
