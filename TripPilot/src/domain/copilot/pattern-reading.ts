/**
 * C20 (DEC-304) — every pattern card states, in WORDS, whether the data reads as
 * positive, worth-a-look, or just informational. The cards already color an icon
 * (success/warning); this adds the explicit reading so the judgment never relies
 * on color alone (WCAG 1.4.1) and an informational card can never be misread as a
 * problem (anti-susto).
 *
 * Pure: these classify values the insights already computed — they NEVER change
 * the math. `watch` maps to amber, NOT red: a pattern is never a real-money
 * emergency (DEC-299 keeps `--error` for over-limit / reserve / critical only).
 */

export type PatternTone = 'good' | 'watch' | 'neutral';

export interface PatternReading {
  tone: PatternTone;
  /** i18n key for the short reading line. */
  labelKey: string;
}

const GOOD: PatternReading = { tone: 'good', labelKey: 'copilot.reading_good' };
const WATCH: PatternReading = { tone: 'watch', labelKey: 'copilot.reading_watch' };
const NEUTRAL: PatternReading = { tone: 'neutral', labelKey: 'copilot.reading_neutral' };

/** Purely descriptive cards (weekday split, peak hour, social mix, cash×card). */
export const NEUTRAL_READING: PatternReading = NEUTRAL;

/** Outings: finishing at/under target on average is good; over is worth a look. */
export function readOutingEfficiency(avgSavingCents: number): PatternReading {
  return avgSavingCents >= 0 ? GOOD : WATCH;
}

/** Projection: ending under budget is good; projected over is worth a look. */
export function readProjection(isOver: boolean): PatternReading {
  return isOver ? WATCH : GOOD;
}

/** Forecast trend: the projected close moving down (improving) is good. */
export function readForecastTrend(direction: 'improving' | 'worsening'): PatternReading {
  return direction === 'improving' ? GOOD : WATCH;
}

/** Runway: the free-to-spend outlasting the phase is good; running short = watch. */
export function readRunway(coversRemaining: boolean): PatternReading {
  return coversRemaining ? GOOD : WATCH;
}

/**
 * Phase pace vs the previous phase: spending less per day now is good, more is
 * worth a look, the same is just informational.
 */
export function readPhasePace(deltaPercent: number): PatternReading {
  if (deltaPercent < 0) return GOOD;
  if (deltaPercent > 0) return WATCH;
  return NEUTRAL;
}
