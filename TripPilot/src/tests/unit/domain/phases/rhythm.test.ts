import { describe, it, expect } from 'vitest';
import {
  isPeakDay,
  getDaySpendingWeight,
  calculateEffectiveSpendingDays,
  calculateFreeToSpendPerDay,
} from '@/domain/phases';
import type { Phase, PhaseRhythmPreset } from '@/domain/types/phase';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function mkPhase(rhythmPreset: PhaseRhythmPreset | null, peakDays: number[] | null): Phase {
  return {
    ...meta,
    id: 'ph-1',
    tripId: 'trip-1',
    name: 'Burgos',
    // 2026-06-08 is a Monday; 2026-06-14 is a Sunday.
    startDate: '2026-06-08',
    endDate: '2026-06-14',
    order: 0,
    rhythmPreset,
    peakDays,
    notes: null,
  };
}

describe('phase rhythm (DEC-075 / FIELD-02)', () => {
  it('uniform phase (null/null) keeps the current behavior: 1 day = 1.0', () => {
    const phase = mkPhase(null, null);
    expect(calculateEffectiveSpendingDays(phase, '2026-06-08')).toBe(7);
    expect(getDaySpendingWeight(phase, '2026-06-13')).toBe(1.0);
  });

  it('Mira scenario: weekend peaks weigh 1.5, moderate weekdays weigh 0.8', () => {
    // peakDays [5,6] = Friday + Saturday.
    const phase = mkPhase('moderate', [5, 6]);
    expect(isPeakDay(phase, '2026-06-13')).toBe(true); // Saturday
    expect(isPeakDay(phase, '2026-06-09')).toBe(false); // Tuesday
    // Mon..Sun = 5 normal × 0.8 + 2 peak × 1.5 = 7 effective days.
    expect(calculateEffectiveSpendingDays(phase, '2026-06-08')).toBeCloseTo(7);
  });

  it('Mira scenario: Saturday allows more free-per-day than Tuesday', () => {
    const phase = mkPhase('moderate', [5, 6]);
    const freeCents = 70_000; // €700 over 7 effective days

    const saturday = calculateFreeToSpendPerDay(freeCents, phase, '2026-06-13');
    const tuesday = calculateFreeToSpendPerDay(freeCents, phase, '2026-06-09');

    // Saturday: weight 1.5 of remaining Sat(1.5)+Sun(0.8) = 2.3 → €456,52.
    expect(saturday.isPeakDay).toBe(true);
    expect(saturday.perDayCents).toBe(Math.round((70_000 * 1.5) / 2.3));
    // Tuesday: weight 0.8 of remaining Tue..Sun (0.8×4 + 1.5×2 = 6.2).
    expect(tuesday.isPeakDay).toBe(false);
    expect(tuesday.perDayCents).toBe(Math.round((70_000 * 0.8) / 6.2));
    expect(saturday.perDayCents).toBeGreaterThan(tuesday.perDayCents);
  });

  it('relaxed preset lowers non-peak days to 0.6', () => {
    const phase = mkPhase('relaxed', [6]);
    // Mon..Sun = 6 × 0.6 + 1 × 1.5 = 5.1 effective days.
    expect(calculateEffectiveSpendingDays(phase, '2026-06-08')).toBeCloseTo(5.1);
  });

  it('peak days without preset weigh 1.5 against a 1.0 base', () => {
    const phase = mkPhase(null, [6]);
    expect(getDaySpendingWeight(phase, '2026-06-13')).toBe(1.5);
    expect(getDaySpendingWeight(phase, '2026-06-09')).toBe(1.0);
  });

  it('returns 0 effective days after the phase ends', () => {
    const phase = mkPhase('moderate', [5, 6]);
    expect(calculateEffectiveSpendingDays(phase, '2026-06-15')).toBe(0);
  });
});
