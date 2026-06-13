import type { Phase } from '@/domain/types/phase';
import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { ForecastSnapshot } from '@/domain/types/forecast-snapshot';
import type { ConfidenceLevel } from '@/domain/types/common';
import type { DebtEntry } from '@/domain/splitting';
import { calculateEffectiveSpendingDays } from '@/domain/phases';
import { calculatePoolSpent } from '@/domain/budget';
import { getTotalDays, localDayOf } from '@/domain/dates';
import { createSyncMetadata } from '@/utils/entity-factory';

/**
 * Rotating dashboard insights (DEC-077 / FIELD-07; E4 Phase 3).
 *
 * Pure builders, one per signal. Each builder returns null when its data is
 * NOT significant (anti-spam is rule #1) — the block only shows cards backed
 * by real signal. Phase 3 (M1) removed the hard cap of 4: every significant
 * insight now shows, ordered by `priority` (warnings break ties). A high
 * safety cap stays so a pathological dataset can never explode the carousel.
 */

/** Safety ceiling so the carousel never renders an absurd number of cards. */
export const INSIGHT_SAFETY_CAP = 12;

/** Projection/rhythm cards need at least this many days of data. */
export const MIN_DAYS_FOR_PROJECTION = 3;

export type DashboardInsightKind =
  | 'end_of_day'
  | 'phase_projection'
  | 'danger_day'
  | 'category_rhythm'
  | 'phase_countdown'
  | 'rhythm_compare'
  | 'no_spend_streak'
  | 'avg_outing_cost'
  | 'participant_balance'
  | 'next_event';

export type InsightTone = 'positive' | 'warning' | 'neutral';

/**
 * M1: importance ranking (higher = shown first). Data-driven so ordering is a
 * table, not branching logic. Ties are broken by tone (warnings first).
 */
export const INSIGHT_PRIORITY: Record<DashboardInsightKind, number> = {
  // M6: a missing day-log prompt is the most actionable card when it fires.
  end_of_day: 100,
  phase_projection: 80,
  // M5/M4: calibrated warnings rank just under the headline projection.
  danger_day: 70,
  category_rhythm: 65,
  rhythm_compare: 60,
  // M11: the between-phases countdown is timely in its short transition window.
  phase_countdown: 55,
  participant_balance: 50,
  next_event: 40,
  avg_outing_cost: 30,
  no_spend_streak: 20,
};

/** M5: today's weekday must spend at least this much MORE than other days. */
export const DANGER_DAY_FACTOR = 1.8;
/** M5: need at least this many past samples of the weekday to trust it. */
export const DANGER_DAY_MIN_SAMPLES = 2;
/** M4: a category is "ahead of pace" past this consumed-vs-elapsed ratio. */
export const CATEGORY_RHYTHM_FACTOR = 1.5;
/** M6: only nudge for a missing day-log in the evening. */
export const END_OF_DAY_HOUR = 18;
/** M11: the between-phases countdown only shows this close to the next phase. */
export const COUNTDOWN_WINDOW_DAYS = 5;

/** Tone order for tie-breaking — warnings surface before neutral/positive. */
const TONE_RANK: Record<InsightTone, number> = { warning: 0, neutral: 1, positive: 2 };

export interface DashboardInsight {
  kind: DashboardInsightKind;
  tone: InsightTone;
  /** M1: importance for ordering — defaults from INSIGHT_PRIORITY per kind. */
  priority: number;
  /** Raw values for i18n interpolation — cents formatted by the UI. */
  values: Record<string, string | number>;
}

export interface BuildInsightsInput {
  /** Local date "YYYY-MM-DD". */
  todayDate: string;
  phase: Phase;
  /** Non-deleted transactions of the active phase (expenses + adjustments). */
  phaseTransactions: Transaction[];
  /** Budget the phase had to work with: current free-to-spend + spent so far. */
  phaseBudgetCents: number;
  /** Totals of completed sessions in the phase (one entry per outing). */
  completedOutingTotalsCents: number[];
  /** Debts involving the owner (already netted by calculateDebts). */
  debts: DebtEntry[];
  ownerId: string;
  /** Trip occurrences — builder filters the upcoming ones itself. */
  occurrences: PlannedOccurrence[];
  /** M4: per-category plan vs spend (cents) for the active phase. */
  categoryRhythm: CategoryRhythmEntry[];
  /** M6: local hour-of-day (0-23) — the end-of-day nudge only fires late. */
  nowHour: number;
  /** M11: the upcoming phase for the between-phases countdown, or null. */
  nextPhase: NextPhaseInfo | null;
}

/** M4: a category's planned budget and actual spend within the phase. */
export interface CategoryRhythmEntry {
  category: string;
  plannedCents: number;
  spentCents: number;
}

/** M11: the next phase and how many days until it starts (≥1). */
export interface NextPhaseInfo {
  name: string;
  daysUntilStart: number;
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  return getTotalDays(startDate, endDate);
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function phaseSpent(input: BuildInsightsInput): number {
  return calculatePoolSpent(input.phaseTransactions);
}

function daysElapsed(input: BuildInsightsInput): number {
  if (input.todayDate < input.phase.startDate) return 0;
  const cappedToday = input.todayDate > input.phase.endDate ? input.phase.endDate : input.todayDate;
  return daysBetweenInclusive(input.phase.startDate, cappedToday);
}

/** Card 1 — end-of-phase projection using effective (rhythm-weighted) days. */
function buildPhaseProjection(input: BuildInsightsInput): DashboardInsight | null {
  const elapsed = daysElapsed(input);
  if (elapsed < MIN_DAYS_FOR_PROJECTION || input.phaseBudgetCents <= 0) return null;

  const spentCents = phaseSpent(input);
  if (spentCents <= 0) return null;

  // Today counts as ELAPSED (it already has data); remaining starts tomorrow.
  const totalEffective = calculateEffectiveSpendingDays(input.phase, input.phase.startDate);
  const remainingEffective = calculateEffectiveSpendingDays(input.phase, nextDay(input.todayDate));
  const elapsedEffective = Math.max(0.1, totalEffective - remainingEffective);

  const perEffectiveDayCents = spentCents / elapsedEffective;
  const projectedCents = Math.round(spentCents + perEffectiveDayCents * remainingEffective);
  const diffCents = projectedCents - input.phaseBudgetCents;

  return {
    kind: 'phase_projection',
    tone: diffCents > 0 ? 'warning' : 'positive',
    priority: INSIGHT_PRIORITY.phase_projection,
    values: {
      projectedCents,
      diffCents: Math.abs(diffCents),
      over: diffCents > 0 ? 1 : 0,
      // DEC-091 (R-09): extra values feeding the "how we got here" detail.
      spentCents,
      budgetCents: input.phaseBudgetCents,
      perDayCents: Math.round(perEffectiveDayCents),
      daysElapsed: elapsed,
      daysRemaining: Math.round(remainingEffective),
    },
  };
}

/** Card 2 — real daily average vs planned daily average. */
function buildRhythmCompare(input: BuildInsightsInput): DashboardInsight | null {
  const elapsed = daysElapsed(input);
  if (elapsed < MIN_DAYS_FOR_PROJECTION || input.phaseBudgetCents <= 0) return null;

  const spentCents = phaseSpent(input);
  if (spentCents <= 0) return null;

  const totalDays = daysBetweenInclusive(input.phase.startDate, input.phase.endDate);
  const realDailyCents = Math.round(spentCents / elapsed);
  const plannedDailyCents = Math.round(input.phaseBudgetCents / Math.max(1, totalDays));
  if (plannedDailyCents <= 0) return null;

  return {
    kind: 'rhythm_compare',
    tone: realDailyCents <= plannedDailyCents ? 'positive' : 'warning',
    priority: INSIGHT_PRIORITY.rhythm_compare,
    values: { realDailyCents, plannedDailyCents, over: realDailyCents > plannedDailyCents ? 1 : 0 },
  };
}

/** Card 3 — consecutive days without spending in the phase (ending today). */
function buildNoSpendStreak(input: BuildInsightsInput): DashboardInsight | null {
  const spendDates = new Set(
    input.phaseTransactions
      .filter((tx) => tx.deletedAt === null && tx.type === 'expense')
      .map((tx) => localDayOf(tx.date)),
  );
  if (spendDates.size === 0) return null;

  let streak = 0;
  const cursor = new Date(`${input.todayDate}T00:00:00`);
  const phaseStart = new Date(`${input.phase.startDate}T00:00:00`);
  while (cursor >= phaseStart) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (spendDates.has(iso)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  if (streak < 2) return null;

  return {
    kind: 'no_spend_streak',
    tone: 'positive',
    priority: INSIGHT_PRIORITY.no_spend_streak,
    values: { days: streak },
  };
}

/** Card 4 — average cost per completed outing in the phase. */
function buildAvgOutingCost(input: BuildInsightsInput): DashboardInsight | null {
  const totals = input.completedOutingTotalsCents;
  if (totals.length < 2) return null;

  const avgCents = Math.round(totals.reduce((sum, c) => sum + c, 0) / totals.length);
  return {
    kind: 'avg_outing_cost',
    tone: 'neutral',
    priority: INSIGHT_PRIORITY.avg_outing_cost,
    values: { avgCents, count: totals.length },
  };
}

/** Card 7 — largest open balance with a participant. */
function buildParticipantBalance(input: BuildInsightsInput): DashboardInsight | null {
  const ownerDebts = input.debts.filter(
    (d) => d.amountCents > 0 && (d.creditorId === input.ownerId || d.debtorId === input.ownerId),
  );
  if (ownerDebts.length === 0) return null;

  const largest = ownerDebts.reduce((max, d) => (d.amountCents > max.amountCents ? d : max));
  const owedToMe = largest.creditorId === input.ownerId;
  return {
    kind: 'participant_balance',
    tone: 'neutral',
    priority: INSIGHT_PRIORITY.participant_balance,
    values: {
      name: owedToMe ? largest.debtorName : largest.creditorName,
      amountCents: largest.amountCents,
      owedToMe: owedToMe ? 1 : 0,
    },
  };
}

/** Card 9 — next upcoming planned event (FIELD-05 integration). */
function buildNextEvent(input: BuildInsightsInput): DashboardInsight | null {
  const upcoming = input.occurrences
    .filter(
      (o): o is PlannedOccurrence & { plannedDate: string } =>
        o.deletedAt === null &&
        !o.isConfirmed &&
        o.linkedSessionId === null &&
        o.plannedDate !== null &&
        o.plannedDate > input.todayDate,
    )
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const next = upcoming[0];
  if (!next) return null;

  const daysUntil = daysBetweenInclusive(input.todayDate, next.plannedDate) - 1;
  return {
    kind: 'next_event',
    tone: 'neutral',
    priority: INSIGHT_PRIORITY.next_event,
    values: {
      name: next.name,
      days: daysUntil,
      reservedCents: next.reservedCents ?? 0,
      hasReserve: next.reservedCents !== null && next.reservedCents > 0 ? 1 : 0,
      // DEC-091 (R-09): tap opens THIS event's editor.
      occurrenceId: next.id,
    },
  };
}

/**
 * M4 — a category is burning its phase plan faster than time is passing
 * ("Bar already ate 60% of the plan on day 3 of 10"). Anti-spam (ÂNCORA 8):
 * only with ≥3 days of data, a real plan for the category, and consumption
 * disproportionate to the elapsed fraction. Reports the worst offender.
 */
function buildCategoryRhythm(input: BuildInsightsInput): DashboardInsight | null {
  const elapsed = daysElapsed(input);
  if (elapsed < MIN_DAYS_FOR_PROJECTION) return null;
  const totalDays = daysBetweenInclusive(input.phase.startDate, input.phase.endDate);
  if (totalDays <= 0) return null;

  const elapsedFraction = elapsed / totalDays;
  let worst: { entry: CategoryRhythmEntry; consumedFraction: number } | null = null;
  for (const entry of input.categoryRhythm) {
    if (entry.plannedCents <= 0 || entry.spentCents <= 0) continue;
    const consumedFraction = entry.spentCents / entry.plannedCents;
    if (consumedFraction < elapsedFraction * CATEGORY_RHYTHM_FACTOR) continue;
    if (!worst || consumedFraction > worst.consumedFraction) worst = { entry, consumedFraction };
  }
  if (!worst) return null;

  return {
    kind: 'category_rhythm',
    tone: 'warning',
    priority: INSIGHT_PRIORITY.category_rhythm,
    values: {
      category: worst.entry.category,
      percent: Math.round(worst.consumedFraction * 100),
      daysElapsed: elapsed,
      totalDays,
      spentCents: worst.entry.spentCents,
      plannedCents: worst.entry.plannedCents,
    },
  };
}

/** Local weekday (0=Sun..6=Sat) of an ISO date, read in local time. */
function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00`).getDay();
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * M5 — "Saturday you spend 2× more, and today is Saturday." Aggregates daily
 * spend by weekday over the phase history; fires ONLY when today's weekday
 * averages ≥ DANGER_DAY_FACTOR of the other days AND has enough past samples
 * (≥ DANGER_DAY_MIN_SAMPLES). Never every day (ÂNCORA 8) — today's own spend
 * is excluded so the signal is a forecast, not a reaction.
 */
function buildDangerDay(input: BuildInsightsInput): DashboardInsight | null {
  if (input.todayDate < input.phase.startDate || input.todayDate > input.phase.endDate) return null;

  const dailyTotals = new Map<string, number>();
  for (const tx of input.phaseTransactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const day = localDayOf(tx.date);
    if (day >= input.todayDate) continue; // only PAST days inform the forecast
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + (tx.personalCostCents ?? tx.amountCents));
  }
  if (dailyTotals.size === 0) return null;

  const todayWeekday = weekdayOf(input.todayDate);
  const sameWeekday: number[] = [];
  const otherWeekday: number[] = [];
  for (const [day, total] of dailyTotals) {
    if (weekdayOf(day) === todayWeekday) sameWeekday.push(total);
    else otherWeekday.push(total);
  }
  if (sameWeekday.length < DANGER_DAY_MIN_SAMPLES || otherWeekday.length === 0) return null;

  const avgSame = average(sameWeekday);
  const avgOther = average(otherWeekday);
  if (avgOther <= 0 || avgSame < avgOther * DANGER_DAY_FACTOR) return null;

  return {
    kind: 'danger_day',
    tone: 'warning',
    priority: INSIGHT_PRIORITY.danger_day,
    values: {
      weekday: todayWeekday,
      multiplier: Math.round((avgSame / avgOther) * 10) / 10,
      avgCents: Math.round(avgSame),
    },
  };
}

/**
 * M6 — nothing logged today and it is already evening: gently prompt a
 * record ("what did you spend today?"). Disappears the moment any expense is
 * registered today; never nags in the morning (END_OF_DAY_HOUR). Informs,
 * never blocks (ÂNCORA 10).
 */
function buildEndOfDay(input: BuildInsightsInput): DashboardInsight | null {
  if (input.nowHour < END_OF_DAY_HOUR) return null;
  if (input.todayDate < input.phase.startDate || input.todayDate > input.phase.endDate) return null;

  const loggedToday = input.phaseTransactions.some(
    (tx) => tx.deletedAt === null && tx.type === 'expense' && localDayOf(tx.date) === input.todayDate,
  );
  if (loggedToday) return null;

  return {
    kind: 'end_of_day',
    tone: 'warning',
    priority: INSIGHT_PRIORITY.end_of_day,
    values: {},
  };
}

/**
 * M11 — "3 days until Eurotrip; you have €40/day until then." Only fires inside
 * the short transition window before the next phase (≤ COUNTDOWN_WINDOW_DAYS)
 * and when there is free money to pace; outside the window it stays silent
 * (ÂNCORA 8). The per-day figure spreads the current free-to-spend over the
 * days remaining before the next phase begins.
 */
function buildPhaseCountdown(input: BuildInsightsInput): DashboardInsight | null {
  const next = input.nextPhase;
  if (!next) return null;
  if (next.daysUntilStart < 1 || next.daysUntilStart > COUNTDOWN_WINDOW_DAYS) return null;

  const freeCents = input.phaseBudgetCents - phaseSpent(input);
  if (freeCents <= 0) return null;

  return {
    kind: 'phase_countdown',
    tone: 'neutral',
    priority: INSIGHT_PRIORITY.phase_countdown,
    values: {
      name: next.name,
      days: next.daysUntilStart,
      perDayCents: Math.round(freeCents / next.daysUntilStart),
    },
  };
}

const INSIGHT_BUILDERS: Array<(input: BuildInsightsInput) => DashboardInsight | null> = [
  buildEndOfDay,
  buildPhaseProjection,
  buildDangerDay,
  buildCategoryRhythm,
  buildPhaseCountdown,
  buildRhythmCompare,
  buildNoSpendStreak,
  buildAvgOutingCost,
  buildParticipantBalance,
  buildNextEvent,
];

/**
 * M1: every significant insight, ordered by importance. No fixed cap of 4 —
 * builders self-censor (return null) so only real signal reaches here. Sort is
 * priority desc, then tone (warnings first). A safety cap is the only ceiling.
 */
export function buildDashboardInsights(input: BuildInsightsInput): DashboardInsight[] {
  return INSIGHT_BUILDERS.map((build) => build(input))
    .filter((insight): insight is DashboardInsight => insight !== null)
    .sort((a, b) => b.priority - a.priority || TONE_RANK[a.tone] - TONE_RANK[b.tone])
    .slice(0, INSIGHT_SAFETY_CAP);
}

/* ──────────────── Daily forecast snapshot (DEC-077 / M8.3) ──────────────── */

export interface CreateForecastSnapshotInput {
  tripId: string;
  phaseId: string;
  snapshotDate: string;
  totalBudgetCents: number;
  totalSpentCents: number;
  freeToSpendCents: number;
  avgDailySpendCents: number;
  projectedEndSpendCents: number;
  daysOfData: number;
}

function confidenceForDays(daysOfData: number): ConfidenceLevel {
  if (daysOfData >= 7) return 'high';
  if (daysOfData >= MIN_DAYS_FOR_PROJECTION) return 'medium';
  return 'low';
}

/** One snapshot per phase per day — history feeds the future sparkline. */
export function createForecastSnapshot(input: CreateForecastSnapshotInput): ForecastSnapshot {
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    phaseId: input.phaseId,
    snapshotDate: input.snapshotDate,
    totalBudgetCents: input.totalBudgetCents,
    totalSpentCents: input.totalSpentCents,
    freeToSpendCents: input.freeToSpendCents,
    avgDailySpendCents: input.avgDailySpendCents,
    projectedEndSpendCents: input.projectedEndSpendCents,
    confidence: confidenceForDays(input.daysOfData),
    notes: null,
  };
}
