import type { Transaction } from '@/domain/types/transaction';
import type { WalletType } from '@/domain/types/common';
import type { PhaseBurndown, MonthHeatmap } from '@/domain/dashboard';
import type { ForecastSnapshot } from '@/domain/types/forecast-snapshot';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';
import { localDayOf } from '@/domain/dates';

/**
 * Copiloto intelligence (DEC-177/178) — pure cross-cuts over data the user
 * already has but can't read at a glance. Each function self-censors (returns
 * null or zeros) when the data is too thin, so the page can gate on real
 * signal and never render an empty module.
 *
 * See brain/documents/copilot-intelligence-2026-06-15.md.
 */

export type CopilotVerdictStatus = 'ahead' | 'on_track' | 'behind';

export interface CopilotVerdict {
  status: CopilotVerdictStatus;
  /** spent − ideal to date (negative = under the planned pace). */
  deltaCents: number;
  spentToDateCents: number;
  idealToDateCents: number;
}

/**
 * Band around the ideal pace that still reads as "on track" — 5% of the ideal,
 * floored so tiny phases don't flip status on a single coffee.
 */
export function paceToleranceCents(idealToDateCents: number): number {
  return Math.max(500, Math.round(Math.abs(idealToDateCents) * 0.05));
}

/** "Am I OK?" — derived from the burn-down delta (real vs ideal pace). */
export function buildCopilotVerdict(burndown: PhaseBurndown | null): CopilotVerdict | null {
  if (!burndown) return null;
  const tolerance = paceToleranceCents(burndown.idealToDateCents);
  const delta = burndown.deltaCents;
  let status: CopilotVerdictStatus;
  if (delta < -tolerance) status = 'ahead';
  else if (delta > tolerance) status = 'behind';
  else status = 'on_track';
  return {
    status,
    deltaCents: delta,
    spentToDateCents: burndown.spentToDateCents,
    idealToDateCents: burndown.idealToDateCents,
  };
}

export interface CategorySpend {
  category: string;
  cents: number;
}

/**
 * "De onde veio" — total personal spend per category, base currency, expenses
 * only, sorted high→low. Uses the same per-tx base cost as the budget math.
 */
export function summarizeByCategory(transactions: Transaction[]): CategorySpend[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense' || tx.category === null) continue;
    const prev = totals.get(tx.category) ?? 0;
    totals.set(tx.category, prev + transactionBasePersonalCostCents(tx));
  }
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .filter((c) => c.cents > 0)
    .sort((a, b) => b.cents - a.cents);
}

export interface DailySpendingSummary {
  maxDayCents: number;
  /** Past days (not future) that had any spend. */
  activeDays: number;
  /** monthTotal ÷ activeDays — the typical "spending day", not calendar day. */
  avgPerActiveDayCents: number;
  monthTotalCents: number;
}

/** "Maior dia · média/dia" over the month heatmap (already day-bucketed). */
export function summarizeDailySpending(heatmap: MonthHeatmap): DailySpendingSummary {
  const activeDays = heatmap.days.filter((d) => !d.isFuture && d.totalCents > 0).length;
  const avgPerActiveDayCents =
    activeDays > 0 ? Math.round(heatmap.monthTotalCents / activeDays) : 0;
  return {
    maxDayCents: heatmap.maxDayCents,
    activeDays,
    avgPerActiveDayCents,
    monthTotalCents: heatmap.monthTotalCents,
  };
}

export interface SocialVsSolo {
  sharedCents: number;
  soloCents: number;
  totalCents: number;
  /** 0–100: share of spend that was split with others. */
  sharedPercent: number;
}

/** "Social × solo" — how much of the spend was shared vs spent alone. */
export function summarizeSocialVsSolo(transactions: Transaction[]): SocialVsSolo {
  let sharedCents = 0;
  let soloCents = 0;
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const cents = transactionBasePersonalCostCents(tx);
    if (tx.isShared) sharedCents += cents;
    else soloCents += cents;
  }
  const totalCents = sharedCents + soloCents;
  const sharedPercent = totalCents > 0 ? Math.round((sharedCents / totalCents) * 100) : 0;
  return { sharedCents, soloCents, totalCents, sharedPercent };
}

export interface PhasePaceComparison {
  currentPerDayCents: number;
  previousPerDayCents: number;
  /** Signed % change vs the previous phase (negative = spending less now). */
  deltaPercent: number;
}

/**
 * "Como ficou vs a fase anterior" — daily-pace comparison between the current
 * phase and the previous one. Null until both phases have real spend.
 */
export function comparePhasePace(
  currentSpentCents: number,
  currentDays: number,
  previousSpentCents: number,
  previousDays: number,
): PhasePaceComparison | null {
  if (currentDays <= 0 || previousDays <= 0) return null;
  if (currentSpentCents <= 0 || previousSpentCents <= 0) return null;
  const currentPerDayCents = Math.round(currentSpentCents / currentDays);
  const previousPerDayCents = Math.round(previousSpentCents / previousDays);
  if (previousPerDayCents <= 0) return null;
  const deltaPercent = Math.round(
    ((currentPerDayCents - previousPerDayCents) / previousPerDayCents) * 100,
  );
  return { currentPerDayCents, previousPerDayCents, deltaPercent };
}

export interface ForecastTrend {
  /** Projecting to spend LESS now ('improving') or MORE ('worsening'). */
  direction: 'improving' | 'worsening';
  firstProjectedCents: number;
  latestProjectedCents: number;
  /** latest − first (negative = improving). */
  deltaCents: number;
  /** Calendar days the comparison spans (first→last snapshot). */
  daysSpan: number;
  snapshotCount: number;
}

/**
 * "Rota corrigindo" (DEC-181) — the trend of the projected end-of-phase spend
 * across the daily forecast snapshots. This is the only time series the app
 * keeps, so it's the one place that can answer "how it WAS heading vs how it's
 * heading now". Self-censors when there's no real movement (flat → null).
 */
export function summarizeForecastTrend(snapshots: ForecastSnapshot[]): ForecastTrend | null {
  const ordered = snapshots
    .filter((s) => s.deletedAt === null && s.projectedEndSpendCents > 0)
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  if (ordered.length < 2) return null;

  const first = ordered[0]!;
  const latest = ordered[ordered.length - 1]!;
  const deltaCents = latest.projectedEndSpendCents - first.projectedEndSpendCents;
  const tolerance = Math.max(500, Math.round(first.projectedEndSpendCents * 0.03));
  if (Math.abs(deltaCents) <= tolerance) return null;

  const daysSpan = Math.max(
    1,
    Math.round(
      (Date.parse(latest.snapshotDate) - Date.parse(first.snapshotDate)) / 86_400_000,
    ),
  );
  return {
    direction: deltaCents < 0 ? 'improving' : 'worsening',
    firstProjectedCents: first.projectedEndSpendCents,
    latestProjectedCents: latest.projectedEndSpendCents,
    deltaCents,
    daysSpan,
    snapshotCount: ordered.length,
  };
}

export interface Runway {
  /** Whole days the free-to-spend lasts at the current daily pace. */
  days: number;
  /** True when the free budget outlasts the days left in the phase. */
  coversRemaining: boolean;
}

/**
 * "Quanto seu livre dura" (DEC-182) — runway of the free-to-spend at today's
 * average daily pace, compared to the days left in the phase. Reuse only (no
 * new data). Null until there's both free budget and a real daily pace.
 */
export function calculateRunway(
  freeToSpendCents: number,
  avgDailyCents: number,
  daysLeftInPhase: number,
): Runway | null {
  if (freeToSpendCents <= 0 || avgDailyCents <= 0 || daysLeftInPhase <= 0) return null;
  const days = Math.floor(freeToSpendCents / avgDailyCents);
  return { days, coversRemaining: days >= daysLeftInPhase };
}

export interface WeekdayPattern {
  /** Average spend of a weekday DAY that had spend (Mon–Fri). */
  weekdayAvgCents: number;
  /** Average spend of a weekend DAY that had spend (Sat–Sun). */
  weekendAvgCents: number;
  /** weekendAvg ÷ weekdayAvg, one decimal (e.g. 2.1). */
  ratio: number;
  weekendIsPricier: boolean;
}

/**
 * "Dia da semana" (DEC-183) — what a weekend day costs vs a weekday day. Days
 * are bucketed locally, then averaged per distinct spending day of each kind.
 * Null until there's at least one of each with spend.
 */
export function summarizeWeekdayPattern(transactions: Transaction[]): WeekdayPattern | null {
  const byDay = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const cents = transactionBasePersonalCostCents(tx);
    if (cents <= 0) continue;
    const dayIso = localDayOf(tx.date);
    byDay.set(dayIso, (byDay.get(dayIso) ?? 0) + cents);
  }

  let weekendSum = 0;
  let weekendDays = 0;
  let weekdaySum = 0;
  let weekdayDays = 0;
  for (const [dayIso, cents] of byDay) {
    const [y, m, d] = dayIso.split('-').map(Number);
    const weekday = new Date(y!, m! - 1, d!).getDay(); // 0=Sun … 6=Sat, local
    if (weekday === 0 || weekday === 6) {
      weekendSum += cents;
      weekendDays += 1;
    } else {
      weekdaySum += cents;
      weekdayDays += 1;
    }
  }
  if (weekendDays === 0 || weekdayDays === 0) return null;

  const weekdayAvgCents = Math.round(weekdaySum / weekdayDays);
  const weekendAvgCents = Math.round(weekendSum / weekendDays);
  if (weekdayAvgCents <= 0) return null;
  const ratio = Math.round((weekendAvgCents / weekdayAvgCents) * 10) / 10;
  return {
    weekdayAvgCents,
    weekendAvgCents,
    ratio,
    weekendIsPricier: weekendAvgCents > weekdayAvgCents,
  };
}

export interface OutingResult {
  targetCents: number;
  totalCents: number;
}

export interface OutingEfficiency {
  /** Closed outings that had a target. */
  total: number;
  /** Of those, how many finished at or under target. */
  withinTarget: number;
  /** Average (target − total) across them; positive = saved on average. */
  avgSavingCents: number;
}

/**
 * "Eficiência das saídas" (DEC-184) — across closed outings that had a target,
 * how many stayed within it and the average saving. Null until there are at
 * least two such outings (one is not a pattern).
 */
export function summarizeOutingEfficiency(outings: OutingResult[]): OutingEfficiency | null {
  if (outings.length < 2) return null;
  let withinTarget = 0;
  let savingSum = 0;
  for (const o of outings) {
    if (o.totalCents <= o.targetCents) withinTarget += 1;
    savingSum += o.targetCents - o.totalCents;
  }
  return {
    total: outings.length,
    withinTarget,
    avgSavingCents: Math.round(savingSum / outings.length),
  };
}

/* ─────────────── B10 (DEC-184 backlog): four more data-gated cross-cuts ─────────────── */

export interface PaymentMix {
  cashCents: number;
  cardCents: number;
  /** Spend on `other`-typed wallets or with no wallet — not classifiable. */
  untrackedCents: number;
  /** cash + card — the base for the ratio. */
  classifiedCents: number;
  /** 0–100 share of classified spend paid in cash. */
  cashPercent: number;
}

const CASH_WALLET_TYPES: ReadonlySet<WalletType> = new Set<WalletType>(['cash']);
const CARD_WALLET_TYPES: ReadonlySet<WalletType> = new Set<WalletType>([
  'debit_card',
  'credit_card',
  'digital',
]);

/**
 * "Dinheiro × cartão" (B10) — how the spend splits between cash and card, the
 * reliability angle (cash leaks from the ledger more easily than card). A mix
 * needs BOTH sides, so it self-censors until there's cash AND card spend.
 */
export function summarizePaymentMix(
  transactions: Transaction[],
  walletTypeById: Map<string, WalletType>,
): PaymentMix | null {
  let cashCents = 0;
  let cardCents = 0;
  let untrackedCents = 0;
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const cents = transactionBasePersonalCostCents(tx);
    if (cents <= 0) continue;
    const type = tx.walletId ? walletTypeById.get(tx.walletId) : undefined;
    if (type && CASH_WALLET_TYPES.has(type)) cashCents += cents;
    else if (type && CARD_WALLET_TYPES.has(type)) cardCents += cents;
    else untrackedCents += cents;
  }
  if (cashCents <= 0 || cardCents <= 0) return null;
  const classifiedCents = cashCents + cardCents;
  return {
    cashCents,
    cardCents,
    untrackedCents,
    classifiedCents,
    cashPercent: Math.round((cashCents / classifiedCents) * 100),
  };
}

export interface HomeCurrencyTotal {
  /** Whole-trip personal spend, in the trip's base (home) currency. */
  totalCents: number;
  expenseCount: number;
}

/**
 * "No total, na sua moeda" (B10) — the single anchor number: everything spent so
 * far, converted to the home currency. Null until there's any real spend.
 */
export function summarizeHomeCurrencyTotal(transactions: Transaction[]): HomeCurrencyTotal | null {
  let totalCents = 0;
  let expenseCount = 0;
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const cents = transactionBasePersonalCostCents(tx);
    if (cents <= 0) continue;
    totalCents += cents;
    expenseCount += 1;
  }
  if (totalCents <= 0) return null;
  return { totalCents, expenseCount };
}

export interface PeakHour {
  /** 0–23 local hour with the most spend. */
  hour: number;
  hourCents: number;
  /** Expenses that landed in that hour. */
  hourCount: number;
  /** 0–100 share of total spend in that hour. */
  sharePercent: number;
}

/**
 * "Hora de pico" (B10) — the local hour of day when the most money goes out.
 * Buckets expenses by their local hour; null until there's a real sample (≥3
 * expenses) and a non-zero peak.
 */
export function summarizePeakHour(transactions: Transaction[]): PeakHour | null {
  const centsByHour = new Array<number>(24).fill(0);
  const countByHour = new Array<number>(24).fill(0);
  let totalCents = 0;
  let expenseCount = 0;
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const cents = transactionBasePersonalCostCents(tx);
    if (cents <= 0) continue;
    const hour = new Date(tx.date).getHours();
    if (Number.isNaN(hour)) continue;
    centsByHour[hour] = (centsByHour[hour] ?? 0) + cents;
    countByHour[hour] = (countByHour[hour] ?? 0) + 1;
    totalCents += cents;
    expenseCount += 1;
  }
  if (expenseCount < 3 || totalCents <= 0) return null;
  let hour = 0;
  for (let h = 1; h < 24; h += 1) {
    if (centsByHour[h]! > centsByHour[hour]!) hour = h;
  }
  const hourCents = centsByHour[hour]!;
  if (hourCents <= 0) return null;
  return {
    hour,
    hourCents,
    hourCount: countByHour[hour]!,
    sharePercent: Math.round((hourCents / totalCents) * 100),
  };
}

export interface DisciplineStreak {
  /** Consecutive most-recent spending days at or under the daily target. */
  currentStreak: number;
  /** Best run of disciplined spending days in the period. */
  longestStreak: number;
  /** Distinct spending days considered. */
  activeDays: number;
  dailyTargetCents: number;
}

/**
 * "Sequência de disciplina" (B10) — how many spending days in a row stayed at or
 * under the daily target (the phase's ideal per-day pace). Counts only days that
 * had spend (a zero-spend day neither breaks nor extends the run). Null until
 * there's a real target and at least a 2-day run to celebrate.
 */
export function summarizeDisciplineStreak(
  transactions: Transaction[],
  dailyTargetCents: number,
): DisciplineStreak | null {
  if (dailyTargetCents <= 0) return null;
  const byDay = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.type !== 'expense') continue;
    const cents = transactionBasePersonalCostCents(tx);
    if (cents <= 0) continue;
    const dayIso = localDayOf(tx.date);
    byDay.set(dayIso, (byDay.get(dayIso) ?? 0) + cents);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (days.length < 2) return null;

  let longestStreak = 0;
  let run = 0;
  for (const [, cents] of days) {
    if (cents <= dailyTargetCents) {
      run += 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }
  if (longestStreak < 2) return null;

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i]![1] <= dailyTargetCents) currentStreak += 1;
    else break;
  }
  return { currentStreak, longestStreak, activeDays: days.length, dailyTargetCents };
}
