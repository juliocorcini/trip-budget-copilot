import type { Transaction } from '@/domain/types/transaction';

/**
 * GATE 6 (D07): per-item price history. PURE, zero-token, offline — the twin of
 * the unit-price comparator (DEC-283/284), but instead of ranking packages it
 * answers "how does what I just paid for THIS item compare to what I paid before?".
 *
 * An item is matched by its NORMALIZED description (accent-insensitive, lowercased,
 * whitespace-collapsed) — no new schema; it reads the transactions already
 * persisted. Prices compare in the trip's BASE currency (`baseCurrencyAmountCents`)
 * so a purchase abroad and one at home line up. Only real expenses count
 * (income/transfers/settlements are not "items"). With fewer than two matching
 * purchases there is no history to show → null.
 */

/** Item-name key: accent-insensitive, lowercased, whitespace-collapsed. */
export function normalizeItemName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PriceHistoryPoint {
  transactionId: string;
  date: string;
  /** Amount in the trip's base currency (comparable across currencies). */
  amountCents: number;
  isCurrent: boolean;
}

export interface PriceHistory {
  normalizedName: string;
  /** How many matching purchases (including the current one). */
  count: number;
  minCents: number;
  maxCents: number;
  avgCents: number;
  currentCents: number;
  /** Signed: current − average (negative = cheaper than usual). */
  deltaFromAvgCents: number;
  isCheapest: boolean;
  isPriciest: boolean;
  /** Every matching purchase, newest first; the current one is flagged. */
  points: PriceHistoryPoint[];
}

export interface BuildPriceHistoryInput {
  current: Transaction;
  transactions: Transaction[];
}

/**
 * Builds the price history for the item behind `current`. Pure: callers pass the
 * focused transaction and the full transaction list. Returns null when the item
 * has no name or no prior purchase to compare against.
 */
export function buildPriceHistory({ current, transactions }: BuildPriceHistoryInput): PriceHistory | null {
  if (current.type !== 'expense') return null;
  const key = normalizeItemName(current.description);
  if (key === '') return null;

  const matches = transactions.filter(
    (t) =>
      t.type === 'expense' &&
      t.deletedAt === null &&
      t.baseCurrencyAmountCents > 0 &&
      normalizeItemName(t.description) === key,
  );
  if (matches.length < 2) return null;

  const amounts = matches.map((t) => t.baseCurrencyAmountCents);
  const minCents = Math.min(...amounts);
  const maxCents = Math.max(...amounts);
  const sumCents = amounts.reduce((acc, c) => acc + c, 0);
  const avgCents = Math.round(sumCents / amounts.length);
  const currentCents = current.baseCurrencyAmountCents;

  const points: PriceHistoryPoint[] = matches
    .map((t) => ({
      transactionId: t.id,
      date: t.date,
      amountCents: t.baseCurrencyAmountCents,
      isCurrent: t.id === current.id,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    normalizedName: key,
    count: matches.length,
    minCents,
    maxCents,
    avgCents,
    currentCents,
    deltaFromAvgCents: currentCents - avgCents,
    isCheapest: currentCents === minCents,
    isPriciest: currentCents === maxCents,
    points,
  };
}
