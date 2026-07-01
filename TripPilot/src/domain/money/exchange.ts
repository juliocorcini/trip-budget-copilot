import type { Transaction } from '@/domain/types/transaction';
import type { FrozenExchangeRates } from '@/domain/types/common';
import { sortByCurrencyPriority } from './currency-meta';

/**
 * E9 (Phase 5): multi-currency conversion. The traveler may log an expense in a
 * foreign currency (e.g. CZK in Prague during a EUR trip). We ALWAYS keep the
 * original value/currency (ÂNCORA 11 — never lose the original) and store the
 * base-currency equivalent alongside it, so every base-currency aggregation
 * (budget, dashboard) stays correct without re-converting on read.
 *
 * Rate convention: `ratePer1Base` = base-currency units per 1 unit of the
 * foreign currency (e.g. 0.04 means 1 CZK = 0.04 EUR). Because both amounts are
 * in cents (×100) and the rate is unit-to-unit, the cents factor cancels:
 *   foreignCents × rate = (foreignUnits×100) × (baseUnits/foreignUnit)
 *                       = baseUnits×100 = baseCents.
 */
export function convertToBaseCents(foreignCents: number, ratePer1Base: number): number {
  return Math.round(foreignCents * ratePer1Base);
}

/**
 * Base-currency budget impact of a transaction (its personal cost, or the full
 * amount when not shared). Backward-compatible: same-currency rows keep their
 * original cents because `exchangeRate` is null, so existing single-currency
 * data and tests are byte-identical. Only foreign rows (rate set) are scaled.
 */
export function transactionBasePersonalCostCents(transaction: Transaction): number {
  const personalCents = transaction.personalCostCents ?? transaction.amountCents;
  if (transaction.exchangeRate === null) return personalCents;
  return Math.round(personalCents * transaction.exchangeRate);
}

/**
 * The frozen rate to use for a given foreign currency, or null when none
 * applies (the currency is the base, or no matching snapshot exists). The
 * traveler can always override with a manual rate in the form.
 */
export function resolveFrozenRate(
  frozen: FrozenExchangeRates | null,
  currency: string,
  baseCurrency: string,
): number | null {
  if (currency === baseCurrency) return null;
  if (!frozen || frozen.baseCurrency !== baseCurrency) return null;
  const rate = frozen.ratesToBase[currency];
  return typeof rate === 'number' && rate > 0 ? rate : null;
}

/**
 * The list of currencies offered in the expense form: always the base first,
 * then any wallet/snapshot currencies, de-duplicated and upper-cased. Pure so
 * the QuickAdd selector stays data-driven (no hard-coded currency list).
 *
 * DEC-423 (G8): the tail (everything after the base) is ordered by priority —
 * the majors (BRL/USD/EUR/CAD/CHF/GBP/JPY) first, then the rest alphabetically —
 * so the currencies a traveler actually uses lead the picker. The base stays
 * pinned at index 0 (it is THE trip currency, even when it is not a major).
 */
export function listSelectableCurrencies(
  baseCurrency: string,
  extraCurrencies: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of [baseCurrency, ...extraCurrencies]) {
    const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
    if (code === '' || seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  if (result.length <= 2) return result;
  const [base, ...tail] = result;
  return [base!, ...sortByCurrencyPriority(tail)];
}
