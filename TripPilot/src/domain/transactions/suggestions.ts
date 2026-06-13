import type { Transaction } from '@/domain/types/transaction';

/**
 * E2 — frictionless capture helpers derived purely from existing transactions
 * (no new table, no IA): description memory (M2), frequent favorites (M3) and
 * the typical-value baseline used by the anomaly guard (M5).
 */

export interface ExpenseSuggestion {
  description: string;
  category: string;
  subcategoryId: string | null;
  amountCents: number;
}

/** Lowercase + strip accents so "Café" and "cafe" match. */
function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const MIN_QUERY_LENGTH = 2;

function isUsableExpense(tx: Transaction): boolean {
  return (
    tx.deletedAt === null &&
    tx.type === 'expense' &&
    tx.category !== null &&
    tx.description.trim() !== ''
  );
}

function toSuggestion(tx: Transaction): ExpenseSuggestion {
  return {
    description: tx.description,
    category: tx.category!,
    subcategoryId: tx.subcategoryId,
    amountCents: tx.amountCents,
  };
}

/**
 * M2 — given the description being typed, suggest the category/subcategory/value
 * from the most recent matching expense. Exact (normalized) matches win over
 * prefix matches; ties break on the most recent date. Returns null when the
 * query is too short or nothing matches.
 */
export function suggestFromDescription(
  transactions: Transaction[],
  text: string,
): ExpenseSuggestion | null {
  const query = normalizeText(text);
  if (query.length < MIN_QUERY_LENGTH) return null;

  const candidates = transactions
    .filter(isUsableExpense)
    .map((tx) => ({ tx, norm: normalizeText(tx.description) }))
    .filter(({ norm }) => norm === query || norm.startsWith(query));

  if (candidates.length === 0) return null;

  const byRecency = (a: { tx: Transaction }, b: { tx: Transaction }) =>
    b.tx.date.localeCompare(a.tx.date);

  const exact = candidates.filter(({ norm }) => norm === query).sort(byRecency);
  if (exact.length > 0) return toSuggestion(exact[0]!.tx);

  const prefix = [...candidates].sort(byRecency);
  return toSuggestion(prefix[0]!.tx);
}

const MIN_FREQUENCY = 2;

/**
 * M3 — the most frequently repeated expenses (same description + category +
 * amount), most frequent first, ties broken by most recent. Only combinations
 * seen at least twice qualify ("repetir" implies repetition).
 */
export function getFrequentExpenses(
  transactions: Transaction[],
  limit = 4,
): ExpenseSuggestion[] {
  const groups = new Map<
    string,
    { suggestion: ExpenseSuggestion; count: number; lastDate: string }
  >();

  for (const tx of transactions) {
    if (!isUsableExpense(tx)) continue;
    const key = `${normalizeText(tx.description)}|${tx.category}|${tx.amountCents}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (tx.date > existing.lastDate) existing.lastDate = tx.date;
    } else {
      groups.set(key, { suggestion: toSuggestion(tx), count: 1, lastDate: tx.date });
    }
  }

  return [...groups.values()]
    .filter((group) => group.count >= MIN_FREQUENCY)
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit)
    .map((group) => group.suggestion);
}

const MIN_TYPICAL_SAMPLES = 3;

/**
 * M5 — the user's typical personal spend in a category (median of past
 * expenses). Returns 0 when there is not enough history, so the anomaly guard
 * stays silent until it has a meaningful baseline.
 */
export function getCategoryTypicalCents(
  transactions: Transaction[],
  category: string,
): number {
  const amounts = transactions
    .filter((tx) => isUsableExpense(tx) && tx.category === category)
    .map((tx) => tx.personalCostCents ?? tx.amountCents)
    .filter((cents) => cents > 0)
    .sort((a, b) => a - b);

  if (amounts.length < MIN_TYPICAL_SAMPLES) return 0;

  const mid = Math.floor(amounts.length / 2);
  return amounts.length % 2 === 0
    ? Math.round((amounts[mid - 1]! + amounts[mid]!) / 2)
    : amounts[mid]!;
}

/**
 * M5 — true when an amount is at least `factor`× the typical value, catching
 * typos like "€180" when the normal is "€6". Never fires without a baseline.
 * This NEVER blocks — it only triggers a confirmation (DEC-053).
 */
export function detectAmountAnomaly(
  amountCents: number,
  typicalCents: number,
  factor = 3,
): boolean {
  if (typicalCents <= 0 || amountCents <= 0) return false;
  return amountCents >= typicalCents * factor;
}
