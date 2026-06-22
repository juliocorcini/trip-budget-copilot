/**
 * U6 (DEC-180): unified occasion counters for the home carousel.
 *
 * Julio's model: ONE carousel that shows the PLANNED occasions first — the
 * "metas" with their remaining/done figures — followed by every other category
 * that has spending, shown as a raw item count with an explicit unit label.
 *
 * - A "planned" counter is a forecast with a real plan (totalPlanned > 0). Its
 *   number means OCCASIONS remaining (a session counts once — DEC-115).
 * - An "activity" counter is a category WITHOUT a plan. Its number means how
 *   many OCCASIONS happened in that category (DEC-262/FB-14): a receipt or an
 *   outing writes many rows under ONE sessionId — that is a single occasion,
 *   not N items; a standalone quick-add (no sessionId) is its own occasion.
 *   Categories already represented by a planned meta are excluded, so a category
 *   shows EITHER its plan OR its occasion count, never both.
 */
import type { OccasionForecast } from '@/domain/forecasting';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Transaction } from '@/domain/types/transaction';
import { groupTransactionsByCategory } from '@/domain/transactions';

export interface PlannedOccasionCounter {
  kind: 'planned';
  /** Stable React key + filter target. */
  key: string;
  profileId: string;
  /** Profile name ("noites de bar"). */
  name: string;
  /** Profile category — drives the accent colour and activity exclusion. */
  category: string;
  /** Occasions still ahead (big number). */
  remaining: number;
  /** Occasions already done (secondary line). */
  done: number;
}

export interface ActivityOccasionCounter {
  kind: 'activity';
  key: string;
  category: string;
  /**
   * How many OCCASIONS happened in this category (DEC-262/FB-14): distinct
   * sessions (receipt/outing/split each count once) plus standalone expenses.
   */
  occasionCount: number;
}

export type OccasionCounterItem = PlannedOccasionCounter | ActivityOccasionCounter;

export interface BuildOccasionCountersInput {
  /** Forecasts for the active phase, already ordered by usage (DEC-076). */
  forecasts: OccasionForecast[];
  /** Trip profiles — used to resolve each forecast's category. */
  profiles: ActivityProfile[];
  /** Expense transactions of the active phase (caller scopes them). */
  transactions: Transaction[];
}

export function buildOccasionCounters(
  input: BuildOccasionCountersInput,
): OccasionCounterItem[] {
  const { forecasts, profiles, transactions } = input;

  // 1) Planned metas — forecasts that actually carry a plan. Usage order from
  // the caller is preserved (used profiles first).
  const planned: PlannedOccasionCounter[] = forecasts
    .filter((forecast) => forecast.totalPlanned > 0)
    .map((forecast) => {
      const profile = profiles.find((p) => p.id === forecast.profileId);
      return {
        kind: 'planned',
        key: forecast.profileId,
        profileId: forecast.profileId,
        name: forecast.profileName,
        category: profile?.category ?? 'other',
        remaining: forecast.remaining,
        done: forecast.spent,
      };
    });

  // Categories already covered by a meta are not repeated as raw counts.
  const plannedCategories = new Set(planned.map((p) => p.category));

  // 2) Activity counters — OCCASION counts (DEC-262/FB-14) for every other
  // category that has expenses. Sorted by count (the busiest categories lead).
  const expenseTxs = transactions.filter((tx) => tx.type === 'expense');
  const groups = groupTransactionsByCategory(expenseTxs);
  const activity: ActivityOccasionCounter[] = Object.entries(groups)
    .filter(([category, txs]) => !plannedCategories.has(category) && txs.length > 0)
    .map(([category, txs]) => ({
      kind: 'activity' as const,
      key: `category:${category}`,
      category,
      occasionCount: countOccasions(txs),
    }))
    .filter((counter) => counter.occasionCount > 0)
    .sort((a, b) => b.occasionCount - a.occasionCount);

  return [...planned, ...activity];
}

/**
 * DEC-262 (FB-14): collapse a receipt/outing's many rows (one shared sessionId)
 * into a single occasion. A receipt of 40 lines used to read "40" in the
 * carousel; it is ONE purchase. Standalone expenses (no sessionId) each count
 * once. So occasions = distinct sessionIds + the number of session-less rows.
 */
function countOccasions(txs: Transaction[]): number {
  const sessionIds = new Set<string>();
  let standalone = 0;
  for (const tx of txs) {
    if (tx.sessionId) sessionIds.add(tx.sessionId);
    else standalone += 1;
  }
  return sessionIds.size + standalone;
}
