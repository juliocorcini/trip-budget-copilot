import type { Phase, PhaseRhythmPreset } from '@/domain/types/phase';
import { getTotalDays } from '@/domain/dates';

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

export function parseLocalDate(isoDate: string): Date {
  // Date-only strings parse as UTC; anchor at noon to avoid TZ day shifts.
  return new Date(`${isoDate.slice(0, 10)}T12:00:00`);
}

export function toLocalIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isPeakDay(phase: Phase, isoDate: string): boolean {
  if (!phase.peakDays || phase.peakDays.length === 0) return false;
  return phase.peakDays.includes(parseLocalDate(isoDate).getDay());
}

/** True when the phase distributes money unevenly (a rhythm preset or peak days). */
export function phaseHasRhythm(phase: Phase): boolean {
  return phase.rhythmPreset !== null || (phase.peakDays?.length ?? 0) > 0;
}

/**
 * Weight of a NON-peak ("common") day under the phase rhythm. Uniform phases
 * and the bare-peak case both return 1.0; presets return their base. Used to
 * explain why a peak day's allowance is larger than a regular day's.
 */
export function getBaseDayWeight(phase: Phase): number {
  if (!phaseHasRhythm(phase)) return 1.0;
  return phase.rhythmPreset !== null ? RHYTHM_BASE_WEIGHT[phase.rhythmPreset] : 1.0;
}

/** Weight of a single day under the phase rhythm. */
export function getDaySpendingWeight(phase: Phase, isoDate: string): number {
  if (!phaseHasRhythm(phase)) return 1.0;
  if (isPeakDay(phase, isoDate)) return PEAK_DAY_WEIGHT;
  return getBaseDayWeight(phase);
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
    // PAR-006 (R6-05): local day, not toISOString() — UTC+13/14 shifted the weekday.
    total += getDaySpendingWeight(phase, toLocalIsoDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

export interface FreeToSpendPerDay {
  perDayCents: number;
  isPeakDay: boolean;
}

export interface TodayFreeBudget {
  /** Allowance fixed at day start — computed WITHOUT today's spending. */
  todayAllowanceCents: number;
  todaySpentCents: number;
  /** "Free to use today" = allowance − spent today. Negative when overspent. */
  freeTodayCents: number;
  /**
   * Today's RHYTHM pace projected forward: free × today's weight ÷ effective
   * days. On a peak day this is inflated by the peak weight — it answers "at
   * today's pace, how much per day", NOT a flat average. Labeled "today's
   * rhythm" in the UI (DEC-392).
   */
  avgDailyUntilEndCents: number;
  /**
   * DEC-392 (parte 2, G2): the HONEST flat average — remaining free money ÷
   * remaining CALENDAR days (unweighted). This is the "média até o fim" the user
   * expects (≈€18, not the peak-weighted ≈€32). Independent of which day is peak.
   */
  avgUntilEndFlatCents: number;
  isPeakDay: boolean;
}

/**
 * DEC-415 (G4): the cofrinho cap. When the buffer (piggy) has a positive balance,
 * the day's leftover is already being PARKED in the cofrinho — so the daily hero
 * must NOT also re-inflate by re-spreading the same leftover over fewer days. The
 * allowance is capped at the day's ideal-base, and the difference is exactly what
 * the cofrinho holds (Â-MONEY-INVARIANT: the TOTAL free is untouched; only the
 * daily READING changes). Absent → byte-identical to the pre-DEC-415 behavior.
 */
export interface TodayFreeBudgetPiggyCap {
  /** Current cofrinho (buffer) balance; the cap applies only when this is > 0. */
  balanceCents: number;
  /** Today's ideal-base (linear or rhythm-aware) — the allowance ceiling. */
  baseDailyIdealCents: number;
}

/**
 * DEC-088 (R-06): subtractive "free to use today". The day's allowance is the
 * weighted share of the budget as it was at the START of the day (today's
 * spending added back), so registering a €2 expense drops the number by
 * exactly €2 — not by €2 ÷ remaining days.
 *
 * DEC-415 (G4): when a `piggyCap` with a positive balance is passed, the daily
 * allowance (and the derived "free today") is capped at the day's ideal-base so
 * an under-spent day no longer inflates the next day's hero — the leftover lives
 * in the cofrinho instead. The cap never RAISES the allowance (min only), never
 * applies on the last day / phase-over edge, and leaves `avgUntilEndFlat` and the
 * total free untouched.
 */
export function calculateTodayFreeBudget(
  freeToSpendCents: number,
  todaySpentCents: number,
  phase: Phase,
  todayIso: string,
  piggyCap?: TodayFreeBudgetPiggyCap,
): TodayFreeBudget {
  const peak = isPeakDay(phase, todayIso);
  const effectiveDays = calculateEffectiveSpendingDays(phase, todayIso);
  const startOfDayFreeCents = freeToSpendCents + todaySpentCents;
  const calendarDaysLeft = Math.max(0, getTotalDays(todayIso, phase.endDate));
  const avgUntilEndFlatCents =
    calendarDaysLeft > 0
      ? Math.round(Math.max(0, freeToSpendCents) / calendarDaysLeft)
      : Math.max(0, freeToSpendCents);

  if (effectiveDays <= 0 || startOfDayFreeCents <= 0) {
    return {
      todayAllowanceCents: Math.max(0, startOfDayFreeCents),
      todaySpentCents,
      freeTodayCents: Math.max(0, startOfDayFreeCents) - todaySpentCents,
      avgDailyUntilEndCents: Math.max(0, freeToSpendCents),
      avgUntilEndFlatCents,
      isPeakDay: peak,
    };
  }

  const todayWeight = getDaySpendingWeight(phase, todayIso);
  const rawAllowanceCents = Math.round((startOfDayFreeCents * todayWeight) / effectiveDays);
  // DEC-415: cap at the ideal-base only when the cofrinho is actually holding the
  // parked leftover (balance > 0). `min` never inflates; the difference is exactly
  // the cofrinho balance (the total free stays whole).
  const capActive =
    piggyCap !== undefined && piggyCap.balanceCents > 0 && piggyCap.baseDailyIdealCents > 0;
  const todayAllowanceCents = capActive
    ? Math.min(rawAllowanceCents, piggyCap!.baseDailyIdealCents)
    : rawAllowanceCents;

  return {
    todayAllowanceCents,
    todaySpentCents,
    freeTodayCents: todayAllowanceCents - todaySpentCents,
    avgDailyUntilEndCents: Math.max(
      0,
      Math.round((freeToSpendCents * todayWeight) / effectiveDays),
    ),
    avgUntilEndFlatCents,
    isPeakDay: peak,
  };
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
