import type { FrozenExchangeRates } from '@/domain/types/common';
import { fromCents } from './money';
import { getActiveIntlLocale } from '@/domain/locale';

/**
 * DEC-128 + DEC-434: "Ver na minha moeda" — shows every value in the traveler's
 * home currency too ("€20 ≈ R$ 124"). The rate is now taken AUTOMATICALLY from
 * the live FX snapshot (`resolveAnchorRate`, kept fresh by the app-wide warm-up),
 * so there is no fixed number to maintain; a manual rate remains only as the
 * offline fallback when the snapshot doesn't cover the currency.
 */
export interface AnchorConfig {
  /** Currency the traveler thinks in (e.g. 'BRL'). null = feature off. */
  anchorCurrency: string | null;
  /** Rate in effect: how many anchor units 1 unit of the base currency buys. */
  anchorRatePer1: number | null;
}

/**
 * DEC-434: derive the anchor rate (anchor units per 1 base unit) from the frozen
 * FX snapshot. `ratesToBase[X]` is base units per 1 X, so anchor-per-base is its
 * inverse. Returns null when the snapshot is missing, is anchored to a different
 * base, or lacks the anchor currency — the caller then falls back to the manual
 * rate. Pure: never fetches (the warm-up boundary owns the network).
 */
export function anchorRateFromSnapshot(
  rates: FrozenExchangeRates | null,
  anchorCurrency: string | null,
  baseCurrency: string,
): number | null {
  if (!rates || !anchorCurrency) return null;
  const base = baseCurrency.trim().toUpperCase();
  const anchor = anchorCurrency.trim().toUpperCase();
  if (base === '' || anchor === '' || anchor === base) return null;
  if (rates.baseCurrency.trim().toUpperCase() !== base) return null;
  const basePerAnchor = rates.ratesToBase[anchor];
  if (typeof basePerAnchor !== 'number' || !Number.isFinite(basePerAnchor) || basePerAnchor <= 0) {
    return null;
  }
  return 1 / basePerAnchor;
}

/**
 * DEC-434: the anchor rate actually used — the live snapshot rate first
 * (auto-updated), falling back to the traveler's manual rate (offline / a
 * currency the snapshot doesn't cover). Returns null when neither is available.
 */
export function resolveAnchorRate(input: {
  rates: FrozenExchangeRates | null;
  anchorCurrency: string | null;
  baseCurrency: string;
  manualRatePer1: number | null;
}): number | null {
  const auto = anchorRateFromSnapshot(input.rates, input.anchorCurrency, input.baseCurrency);
  if (auto !== null) return auto;
  const manual = input.manualRatePer1;
  return typeof manual === 'number' && Number.isFinite(manual) && manual > 0 ? manual : null;
}

export function isAnchorActive(config: AnchorConfig, baseCurrency: string): boolean {
  return (
    config.anchorCurrency !== null &&
    config.anchorCurrency !== baseCurrency &&
    config.anchorRatePer1 !== null &&
    config.anchorRatePer1 > 0
  );
}

export function convertToAnchorCents(cents: number, ratePer1: number): number {
  return Math.round(cents * ratePer1);
}

/**
 * "≈ R$ 124" — whole units only: the anchor is a mental reference, not an
 * accounting figure, and decimals would suggest a precision the manual rate
 * does not have. Returns null when the anchor is off or equals the base.
 */
export function formatAnchorHint(
  cents: number,
  config: AnchorConfig,
  baseCurrency: string,
  locale: string = getActiveIntlLocale(),
): string | null {
  if (!isAnchorActive(config, baseCurrency)) return null;
  const anchorCents = convertToAnchorCents(cents, config.anchorRatePer1!);
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: config.anchorCurrency!,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(fromCents(anchorCents));
  return `\u2248 ${formatted}`;
}
