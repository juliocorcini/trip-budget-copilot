import type { Transaction } from '@/domain/types/transaction';
import type { PhaseBurndown, MonthHeatmap } from '@/domain/dashboard';
import { transactionBasePersonalCostCents } from '@/domain/money/exchange';

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
