import type { Phase, PhaseRhythmPreset } from '@/domain/types/phase';

/**
 * DEC-075 (FIELD-02): phase rhythm weighting. Peak days weigh 1.5; the
 * other days weigh the preset's base. null preset + null peakDays keeps
 * the current uniform behavior (every day = 1.0).
 */
const PEAK_DAY_WEIGHT = 1.5;

const RHYTHM_BASE_WEIGHT: Record<PhaseRhythmPreset, number> = {
  intense: 1.0,
  moderate: 0.8,
  relaxed: 0.6,
  custom: 1.0,
};

function parseLocalDate(isoDate: string): Date {
  // Date-only strings parse as UTC; anchor at noon to avoid TZ day shifts.
  return new Date(`${isoDate.slice(0, 10)}T12:00:00`);
}

export function isPeakDay(phase: Phase, isoDate: string): boolean {
  if (!phase.peakDays || phase.peakDays.length === 0) return false;
  return phase.peakDays.includes(parseLocalDate(isoDate).getDay());
}

/** Weight of a single day under the phase rhythm. */
export function getDaySpendingWeight(phase: Phase, isoDate: string): number {
  const hasRhythm = phase.rhythmPreset !== null || (phase.peakDays?.length ?? 0) > 0;
  if (!hasRhythm) return 1.0;
  if (isPeakDay(phase, isoDate)) return PEAK_DAY_WEIGHT;
  return phase.rhythmPreset !== null ? RHYTHM_BASE_WEIGHT[phase.rhythmPreset] : 1.0;
}

/**
 * Effective spending days from `fromDate` (inclusive) to the phase end
 * (inclusive): the sum of daily weights. Uniform phases return the plain
 * day count — identical to the pre-DEC-075 behavior.
 */
export function calculateEffectiveSpendingDays(phase: Phase, fromDateIso: string): number {
  const start = parseLocalDate(fromDateIso);
  const end = parseLocalDate(phase.endDate);
  if (start > end) return 0;

  let total = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    total += getDaySpendingWeight(phase, cursor.toISOString());
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

export interface FreeToSpendPerDay {
  perDayCents: number;
  isPeakDay: boolean;
}

/**
 * Weighted free-to-spend for a given day: the day's share of the remaining
 * budget is proportional to its weight ("today is a peak day — free up to €X").
 */
export function calculateFreeToSpendPerDay(
  freeToSpendCents: number,
  phase: Phase,
  todayIso: string,
): FreeToSpendPerDay {
  const effectiveDays = calculateEffectiveSpendingDays(phase, todayIso);
  if (effectiveDays <= 0 || freeToSpendCents <= 0) {
    return { perDayCents: Math.max(0, freeToSpendCents), isPeakDay: isPeakDay(phase, todayIso) };
  }
  const todayWeight = getDaySpendingWeight(phase, todayIso);
  return {
    perDayCents: Math.round((freeToSpendCents * todayWeight) / effectiveDays),
    isPeakDay: isPeakDay(phase, todayIso),
  };
}
