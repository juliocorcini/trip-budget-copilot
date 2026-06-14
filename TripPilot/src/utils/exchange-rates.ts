import type { FrozenExchangeRates } from '@/domain/types/common';
import { isOnline } from '@/utils/places';

/**
 * E9 (M11): the exchange-rate snapshot boundary. Isolated so the domain stays
 * pure and offline-first (ÂNCORA 10): this is the ONLY place that fetches FX
 * rates, it is OPT-IN (the traveler taps "update rates"), online-only, and
 * NEVER throws or blocks — it resolves null on offline/timeout/error so the
 * manual rate fallback always works. Once pulled, the snapshot is frozen in
 * AppSettings and reused offline.
 */

// open.er-api.com: free, no API key, daily reference rates.
const EXCHANGE_RATES_URL = 'https://open.er-api.com/v6/latest';
const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

/**
 * Pulls today's rates for the base currency and freezes them. Returns null on
 * offline, timeout, HTTP error, or an unparsable/failed payload. Rates are
 * stored as base-units-per-1-foreign-unit (the inverse of the API's
 * foreign-per-base), ready to multiply a foreign-cents amount directly.
 */
export async function fetchExchangeRates(
  baseCurrency: string,
  timeoutMs = 8000,
): Promise<FrozenExchangeRates | null> {
  const base = typeof baseCurrency === 'string' ? baseCurrency.trim().toUpperCase() : '';
  if (!CURRENCY_CODE_RE.test(base)) return null;
  if (!isOnline() || typeof fetch === 'undefined') return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(`${EXCHANGE_RATES_URL}/${encodeURIComponent(base)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    if (data['result'] !== 'success') return null;

    const rawRates = data['rates'];
    if (!rawRates || typeof rawRates !== 'object') return null;

    const ratesToBase = invertRates(rawRates as Record<string, unknown>, base);
    if (Object.keys(ratesToBase).length === 0) return null;

    return {
      baseCurrency: base,
      fetchedAt: new Date().toISOString(),
      ratesToBase,
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Converts the API's "foreign units per 1 base unit" map into the inverse
 * "base units per 1 foreign unit", skipping the base itself and any invalid or
 * non-positive entry.
 */
function invertRates(
  rawRates: Record<string, unknown>,
  baseCurrency: string,
): Record<string, number> {
  const ratesToBase: Record<string, number> = {};
  for (const [currency, perBase] of Object.entries(rawRates)) {
    const code = currency.trim().toUpperCase();
    if (code === baseCurrency || !CURRENCY_CODE_RE.test(code)) continue;
    if (typeof perBase === 'number' && Number.isFinite(perBase) && perBase > 0) {
      ratesToBase[code] = 1 / perBase;
    }
  }
  return ratesToBase;
}
