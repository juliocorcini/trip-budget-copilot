import type { Transaction } from '@/domain/types/transaction';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';
import { localDayOf } from '@/domain/dates';
import {
  summarizeByCategory,
  summarizeSocialVsSolo,
  summarizeHomeCurrencyTotal,
  summarizePeakHour,
  summarizeDisciplineStreak,
} from './copilot-insights';
import type { SocialVsSolo, PeakHour, DisciplineStreak } from './copilot-insights';

/**
 * Trip "Wrapped" (Copilot module H / DEC-246) — an end-of-trip retrospective
 * assembled ONLY from existing pure derivations. Every stat self-censors
 * (returns null) when its data is too thin, so the UI never fabricates a
 * superlative ("categoria nº1" with zero spend, a streak with no target, …).
 * Reachable mid-trip as a preview; {@link TripWrapped.ended} flips true once the
 * trip's end date has passed, turning the preview into a real recap.
 *
 * See brain/documents/copilot-expansion-2026-06-15.md (module H) and
 * improvement-backlog-ranked-2026-06-19.md (C1).
 */

export interface WrappedBiggestDay {
  /** Local day `YYYY-MM-DD` of the biggest single spending day. */
  dayIso: string;
  cents: number;
}

export interface WrappedTopCategory {
  category: string;
  cents: number;
  /** 0–100 share of whole-trip personal spend. */
  percent: number;
}

export interface TripWrapped {
  /** Whole-trip personal spend in the base (home) currency. */
  totalCents: number;
  expenseCount: number;
  /** Distinct days that had any spend. */
  activeDays: number;
  /** Biggest single spending day (null until ≥1 active day). */
  biggestDay: WrappedBiggestDay | null;
  /** The #1 category by personal spend (null until there is spend). */
  topCategory: WrappedTopCategory | null;
  /** Social vs solo split (null until there is spend). */
  social: SocialVsSolo | null;
  /** Best disciplined-spending run (null without a target or a 2-day run). */
  streak: DisciplineStreak | null;
  /** The hour of day with the most spend (null below 3 expenses). */
  peakHour: PeakHour | null;
  /** True when the trip's end date is strictly before today — a real recap. */
  ended: boolean;
}

export interface BuildTripWrappedInput {
  transactions: Transaction[];
  /** Trip/phase daily pace; 0 or omitted → the streak stat is omitted. */
  dailyTargetCents?: number;
  /** Trip end date `YYYY-MM-DD`. */
  endDateIso: string;
  /** Today `YYYY-MM-DD` (local). */
  todayIso: string;
}

/** A trip is "ended" once its end date is strictly in the past. */
export function isTripEnded(endDateIso: string, todayIso: string): boolean {
  return endDateIso.length > 0 && todayIso.length > 0 && endDateIso < todayIso;
}

/** Biggest single spending day across the whole trip (personal cost, expenses only). */
function biggestSpendingDay(transactions: Transaction[]): WrappedBiggestDay | null {
  const byDay = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const cents = transactionBasePersonalCostCents(tx);
    if (cents <= 0) continue;
    const dayIso = localDayOf(tx.date);
    byDay.set(dayIso, (byDay.get(dayIso) ?? 0) + cents);
  }
  let best: WrappedBiggestDay | null = null;
  for (const [dayIso, cents] of byDay) {
    if (best === null || cents > best.cents) best = { dayIso, cents };
  }
  return best;
}

/** Distinct calendar days that had any positive personal spend. */
function countActiveDays(transactions: Transaction[]): number {
  const days = new Set<string>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    if (transactionBasePersonalCostCents(tx) <= 0) continue;
    days.add(localDayOf(tx.date));
  }
  return days.size;
}

export function buildTripWrapped(input: BuildTripWrappedInput): TripWrapped {
  const { transactions, dailyTargetCents = 0, endDateIso, todayIso } = input;

  const home = summarizeHomeCurrencyTotal(transactions);
  const totalCents = home?.totalCents ?? 0;

  const categories = summarizeByCategory(transactions);
  const topCategory: WrappedTopCategory | null =
    categories.length > 0 && totalCents > 0
      ? {
          category: categories[0]!.category,
          cents: categories[0]!.cents,
          percent: Math.round((categories[0]!.cents / totalCents) * 100),
        }
      : null;

  return {
    totalCents,
    expenseCount: home?.expenseCount ?? 0,
    activeDays: countActiveDays(transactions),
    biggestDay: biggestSpendingDay(transactions),
    topCategory,
    social: totalCents > 0 ? summarizeSocialVsSolo(transactions) : null,
    streak: dailyTargetCents > 0 ? summarizeDisciplineStreak(transactions, dailyTargetCents) : null,
    peakHour: summarizePeakHour(transactions),
    ended: isTripEnded(endDateIso, todayIso),
  };
}
