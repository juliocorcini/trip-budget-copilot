import { fromCents } from './money';
import { getActiveIntlLocale } from '@/domain/locale';

/**
 * DEC-128: mental currency anchor — "€20 ≈ R$ 124". A manual, offline rate
 * the traveler sets once ("1 EUR = 6.2 BRL"); never fetched from the network
 * (Core Rule 2: offline-first, no hidden dependencies).
 */
export interface AnchorConfig {
  /** Currency the traveler thinks in (e.g. 'BRL'). null = feature off. */
  anchorCurrency: string | null;
  /** Manual rate: how many anchor units 1 unit of the base currency buys. */
  anchorRatePer1: number | null;
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
