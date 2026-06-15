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
 *   many expense ITEMS were registered in that category. Categories already
 *   represented by a planned meta are excluded, so a category shows EITHER its
 *   plan OR its item count, never both.
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
  /** How many expense items were registered in this category (big number). */
  itemCount: number;
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

  // 2) Activity counters — item counts for every other category that has
  // expenses. Sorted by count (the busiest categories lead).
  const expenseTxs = transactions.filter((tx) => tx.type === 'expense');
  const groups = groupTransactionsByCategory(expenseTxs);
  const activity: ActivityOccasionCounter[] = Object.entries(groups)
    .filter(([category, txs]) => !plannedCategories.has(category) && txs.length > 0)
    .map(([category, txs]) => ({
      kind: 'activity' as const,
      key: `category:${category}`,
      category,
      itemCount: txs.length,
    }))
    .sort((a, b) => b.itemCount - a.itemCount);

  return [...planned, ...activity];
}
