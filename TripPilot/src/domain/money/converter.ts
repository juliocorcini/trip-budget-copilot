import type { FrozenExchangeRates } from '@/domain/types/common';
import { listSelectableCurrencies } from './exchange';

/**
 * FB-04 (DEC-256) — the currency converter is a PURE, stateless read over the
 * already-frozen FX snapshot (ÂNCORA 10: rates are never fetched silently). It
 * deliberately does NOT touch the budget math — `convertToBaseCents` stays the
 * single source of truth for an expense's base value; this is just the
 * calculator the traveler opens to answer "how much is this in my money?".
 *
 * Rate convention (identical to exchange.ts): `ratesToBase[X]` = base-currency
 * units per 1 unit of X. The base currency itself is implicitly 1 and is never a
 * key. The converter resolves an arbitrary FROM→TO pair by routing through the
 * base: amount_to = amount_from × (basePerFrom / basePerTo).
 */

export interface ConversionResult {
  /** Converted value, in the TO currency's major units. */
  amount: number;
  /** Units of TO per 1 unit of FROM — the pair rate actually applied. */
  rate: number;
}

function normalizeCode(code: string): string {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function positiveRate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Units of `to` per 1 unit of `from`, derived from a base-anchored snapshot.
 * Returns null when EITHER currency is absent from the snapshot — so the caller
 * shows a manual-rate field instead of a wrong number (Critic: a converter that
 * lies is worse than none). A same-currency pair is 1; a null snapshot only
 * resolves the trivial same-currency case.
 */
export function pairRate(from: string, to: string, rates: FrozenExchangeRates | null): number | null {
  const f = normalizeCode(from);
  const t = normalizeCode(to);
  if (f === '' || t === '') return null;
  if (f === t) return 1;
  if (!rates) return null;
  const base = normalizeCode(rates.baseCurrency);
  const basePerFrom = f === base ? 1 : positiveRate(rates.ratesToBase[f]);
  const basePerTo = t === base ? 1 : positiveRate(rates.ratesToBase[t]);
  if (basePerFrom === null || basePerTo === null) return null;
  return basePerFrom / basePerTo;
}

/**
 * Converts `amount` (major units of `from`) into `to` using the snapshot.
 * Returns null when the pair can't be resolved (missing currency → the caller
 * offers a manual rate) or the amount is non-finite/negative.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: FrozenExchangeRates | null,
): ConversionResult | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const rate = pairRate(from, to, rates);
  if (rate === null) return null;
  return { amount: amount * rate, rate };
}

/**
 * Converts with a manual rate the traveler typed (units of TO per 1 FROM) — the
 * offline / override path that is always one tap away. Rejects a non-positive
 * rate or a non-finite/negative amount.
 */
export function convertWithManualRate(amount: number, ratePer1: number): ConversionResult | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!Number.isFinite(ratePer1) || ratePer1 <= 0) return null;
  return { amount: amount * ratePer1, rate: ratePer1 };
}

/**
 * The currencies the converter offers: the snapshot base + every currency in
 * the snapshot + any extra (trip/wallet) currencies, de-duplicated and
 * upper-cased. Reuses `listSelectableCurrencies` so the picker stays
 * data-driven (no hard-coded currency list).
 */
export function converterCurrencies(rates: FrozenExchangeRates | null, extra: string[]): string[] {
  const base = rates ? rates.baseCurrency : (extra[0] ?? '');
  const snapshot = rates ? Object.keys(rates.ratesToBase) : [];
  return listSelectableCurrencies(base, [...snapshot, ...extra]);
}

/**
 * Whole days since the snapshot was fetched — drives the "rate from DD/MM ·
 * N days ago" honesty stamp. Returns null when there is no snapshot or the
 * timestamp is unusable; clamps a future timestamp to 0.
 */
export function rateAgeDays(rates: FrozenExchangeRates | null, now: Date): number | null {
  if (!rates) return null;
  const fetched = Date.parse(rates.fetchedAt);
  if (!Number.isFinite(fetched)) return null;
  const ms = now.getTime() - fetched;
  if (ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}
