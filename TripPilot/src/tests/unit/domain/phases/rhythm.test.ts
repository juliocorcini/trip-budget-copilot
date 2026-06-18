import { describe, it, expect } from 'vitest';
import {
  isPeakDay,
  phaseHasRhythm,
  getBaseDayWeight,
  getDaySpendingWeight,
  calculateEffectiveSpendingDays,
  calculateFreeToSpendPerDay,
  calculateTodayFreeBudget,
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

describe('phaseHasRhythm / getBaseDayWeight (GATE 19 — day-detail explainer)', () => {
  it('uniform phase has no rhythm and a base weight of 1.0', () => {
    const phase = mkPhase(null, null);
    expect(phaseHasRhythm(phase)).toBe(false);
    expect(getBaseDayWeight(phase)).toBe(1.0);
  });

  it('a preset alone (no peak days) already counts as rhythm', () => {
    const phase = mkPhase('relaxed', null);
    expect(phaseHasRhythm(phase)).toBe(true);
    expect(getBaseDayWeight(phase)).toBe(0.6);
  });

  it('peak days alone count as rhythm; base stays 1.0 without a preset', () => {
    const phase = mkPhase(null, [6]);
    expect(phaseHasRhythm(phase)).toBe(true);
    expect(getBaseDayWeight(phase)).toBe(1.0);
  });

  it('base weight is the NON-peak weight: a peak day weighs more than the base', () => {
    const phase = mkPhase('moderate', [5, 6]);
    expect(getBaseDayWeight(phase)).toBe(0.8); // a regular moderate day
    // The peak weight (1.5) is what makes Fri/Sat allowances larger.
    expect(getDaySpendingWeight(phase, '2026-06-13')).toBeGreaterThan(getBaseDayWeight(phase));
  });
});

describe('calculateTodayFreeBudget (DEC-088 / R-06)', () => {
  it('Julio scenario: €6,00 allowance − €2,00 spent = €4,00 free today', () => {
    // Uniform 7-day phase starting today: allowance = start-of-day free / 7.
    const phase = mkPhase(null, null);
    // Start of day: €42 free → allowance €6/day. After spending €2 the
    // CURRENT free-to-spend is €40 and today's spending is €2.
    const result = calculateTodayFreeBudget(4_000, 200, phase, '2026-06-08');

    expect(result.todayAllowanceCents).toBe(600); // (4000+200)/7
    expect(result.todaySpentCents).toBe(200);
    expect(result.freeTodayCents).toBe(400); // 6,00 − 2,00 = 4,00 — NOT 5,99
  });

  it('registering an expense drops "free today" by EXACTLY its value', () => {
    const phase = mkPhase(null, null);
    const before = calculateTodayFreeBudget(4_200, 0, phase, '2026-06-08');
    const after = calculateTodayFreeBudget(4_200 - 200, 200, phase, '2026-06-08');

    expect(before.freeTodayCents - after.freeTodayCents).toBe(200);
    expect(before.todayAllowanceCents).toBe(after.todayAllowanceCents);
  });

  it('overspending the allowance goes negative (not clamped to 0)', () => {
    const phase = mkPhase(null, null);
    const result = calculateTodayFreeBudget(3_400, 800, phase, '2026-06-08');
    expect(result.todayAllowanceCents).toBe(600);
    expect(result.freeTodayCents).toBe(-200);
  });

  it('peak day weighting applies to the day-start budget', () => {
    const phase = mkPhase('moderate', [5, 6]);
    // Saturday 2026-06-13: remaining Sat(1.5)+Sun(0.8)=2.3 effective days.
    const result = calculateTodayFreeBudget(6_700, 200, phase, '2026-06-13');
    expect(result.isPeakDay).toBe(true);
    expect(result.todayAllowanceCents).toBe(Math.round((6_900 * 1.5) / 2.3));
    expect(result.freeTodayCents).toBe(result.todayAllowanceCents - 200);
  });

  it('secondary metric: recalculated daily average until phase end', () => {
    const phase = mkPhase(null, null);
    const result = calculateTodayFreeBudget(3_500, 200, phase, '2026-06-08');
    expect(result.avgDailyUntilEndCents).toBe(500); // 3500/7 — the OLD metric
  });

  it('phase ended → allowance equals whatever is left', () => {
    const phase = mkPhase(null, null);
    const result = calculateTodayFreeBudget(1_000, 0, phase, '2026-06-15');
    expect(result.todayAllowanceCents).toBe(1_000);
    expect(result.freeTodayCents).toBe(1_000);
  });
});
