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

describe('avgUntilEndFlatCents (DEC-392 · parte 2, G2 — honest flat average)', () => {
  it('flat average = free ÷ remaining CALENDAR days, independent of the peak weight', () => {
    // Julio scenario: €327 free over 18 calendar days → ~€18,17/day, NOT the
    // peak-weighted ~€32 the old "average" line showed.
    const phase: Phase = {
      ...meta,
      id: 'ph-1',
      tripId: 'trip-1',
      name: 'Long phase',
      startDate: '2026-06-08', // Monday
      endDate: '2026-06-25', // 18 calendar days inclusive
      order: 0,
      rhythmPreset: 'moderate',
      peakDays: [1], // Mondays peak → today (06-08) is a peak day
      notes: null,
    };
    const result = calculateTodayFreeBudget(32_700, 0, phase, '2026-06-08');

    expect(result.isPeakDay).toBe(true);
    expect(result.avgUntilEndFlatCents).toBe(Math.round(32_700 / 18)); // 1817 ≈ €18,17
    // "Today's rhythm" (weighted) is inflated by the 1.5 peak weight → strictly higher.
    expect(result.avgDailyUntilEndCents).toBeGreaterThan(result.avgUntilEndFlatCents);
  });

  it('flat average equals the weighted one on a uniform phase (no rhythm)', () => {
    const phase = mkPhase(null, null); // 7 uniform days from 06-08 to 06-14
    const result = calculateTodayFreeBudget(3_500, 200, phase, '2026-06-08');
    expect(result.avgUntilEndFlatCents).toBe(500); // 3500 / 7 calendar days
    expect(result.avgDailyUntilEndCents).toBe(500);
  });

  it('uses the post-spend free as its base (free already net of today)', () => {
    const phase = mkPhase(null, null);
    const result = calculateTodayFreeBudget(2_800, 700, phase, '2026-06-08');
    expect(result.avgUntilEndFlatCents).toBe(Math.round(2_800 / 7)); // 400
  });

  it('phase ended → flat average is whatever is left (no division by zero)', () => {
    const phase = mkPhase(null, null);
    const result = calculateTodayFreeBudget(1_000, 0, phase, '2026-06-20');
    expect(result.avgUntilEndFlatCents).toBe(1_000);
  });
});

// DEC-415 (G4) — the cofrinho cap. ÂNCORA test (Â-MONEY-INVARIANT): the cap only
// changes the DAILY reading (`todayAllowance`/`freeToday`), never the total free
// nor `avgUntilEndFlat`, and is byte-identical to the pre-DEC-415 behavior when no
// cap is passed. Uniform 10-day phase, €90 free, nothing spent — the exact G0
// proof-B scenario where under-spending inflates the next day's hero €9 → €10.
describe('calculateTodayFreeBudget cofrinho cap (DEC-415 · Â-MONEY-INVARIANT)', () => {
  const phase10: Phase = {
    ...meta,
    id: 'ph-10',
    tripId: 'trip-1',
    name: 'Ten days',
    startDate: '2026-06-10',
    endDate: '2026-06-19', // 10 calendar days inclusive, uniform
    order: 0,
    rhythmPreset: null,
    peakDays: null,
    notes: null,
  };
  const FREE = 9_000;

  it('without a cap, an under-spent day still inflates the next day (baseline, byte-identical)', () => {
    // No 5th arg → the pre-DEC-415 numbers exactly (locks back-compat).
    expect(calculateTodayFreeBudget(FREE, 0, phase10, '2026-06-10').todayAllowanceCents).toBe(900); // 9000/10
    expect(calculateTodayFreeBudget(FREE, 0, phase10, '2026-06-11').todayAllowanceCents).toBe(1_000); // 9000/9 (inflation)
  });

  it('with a positive cofrinho, day 2 is capped at the ideal-base — no inflation', () => {
    const capped = calculateTodayFreeBudget(FREE, 0, phase10, '2026-06-11', {
      balanceCents: 100, // buffer holds the parked leftover
      baseDailyIdealCents: 900, // €90 / 10 days
    });
    expect(capped.todayAllowanceCents).toBe(900); // capped, not 1000
    expect(capped.freeTodayCents).toBe(900);
  });

  it('the cap only touches the daily reading — avgUntilEndFlat and total free are untouched', () => {
    const uncapped = calculateTodayFreeBudget(FREE, 0, phase10, '2026-06-11');
    const capped = calculateTodayFreeBudget(FREE, 0, phase10, '2026-06-11', {
      balanceCents: 100,
      baseDailyIdealCents: 900,
    });
    // Only the hero changed; the honest flat average is identical bit-for-bit.
    expect(capped.avgUntilEndFlatCents).toBe(uncapped.avgUntilEndFlatCents); // 9000/9 = 1000
    // The exact amount removed from the daily hero is what the cofrinho parks.
    expect(uncapped.todayAllowanceCents - capped.todayAllowanceCents).toBe(100);
  });

  it('the cap is gated on a positive balance — a zero cofrinho changes nothing', () => {
    const result = calculateTodayFreeBudget(FREE, 0, phase10, '2026-06-11', {
      balanceCents: 0,
      baseDailyIdealCents: 900,
    });
    expect(result.todayAllowanceCents).toBe(1_000); // gate off → unchanged
  });

  it('the cap never RAISES the allowance (min only)', () => {
    // Ideal-base far above the (already small) allowance → allowance is kept.
    const result = calculateTodayFreeBudget(FREE, 0, phase10, '2026-06-11', {
      balanceCents: 5_000,
      baseDailyIdealCents: 5_000,
    });
    expect(result.todayAllowanceCents).toBe(1_000); // min(1000, 5000) = 1000
  });

  it('subtractive invariant survives the cap: spending €2 drops "free today" by exactly €2', () => {
    const cap = { balanceCents: 100, baseDailyIdealCents: 900 } as const;
    const before = calculateTodayFreeBudget(FREE, 0, phase10, '2026-06-11', cap);
    const after = calculateTodayFreeBudget(FREE - 200, 200, phase10, '2026-06-11', cap);
    expect(before.freeTodayCents - after.freeTodayCents).toBe(200);
  });

  it('never caps on the phase-over edge — the last leftover is fully spendable', () => {
    // After the phase end the allowance is the full remaining free even with a cap
    // (there is no "tomorrow" to save for), so the cap is deliberately ignored.
    const result = calculateTodayFreeBudget(1_000, 0, phase10, '2026-06-25', {
      balanceCents: 500,
      baseDailyIdealCents: 100,
    });
    expect(result.todayAllowanceCents).toBe(1_000);
  });
});
