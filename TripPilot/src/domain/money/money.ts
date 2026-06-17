import { getActiveIntlLocale } from '@/domain/locale';

const CENTS_MULTIPLIER = 100;

export function toCents(value: number): number {
  return Math.round(value * CENTS_MULTIPLIER);
}

export function fromCents(cents: number): number {
  return cents / CENTS_MULTIPLIER;
}

/** ISO-4217 codes are exactly three ASCII letters; anything else makes
 * Intl.NumberFormat throw RangeError in currency style. */
const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

// PAR-002 (R6-16): defaults to the active i18n language via the locale bridge,
// so the existing call sites follow the user's language without changes.
//
// BUG-010: a trip imported/synced with an invalid `baseCurrency` (arbitrary
// string) used to throw RangeError here and crash EVERY screen that formats
// money. formatMoney must NEVER throw — it falls back to a plain number plus
// the raw code as text (e.g. "12.50 XYZ").
export function formatMoney(
  cents: number,
  currency: string,
  locale: string = getActiveIntlLocale(),
): string {
  const value = fromCents(cents);
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';

  if (CURRENCY_CODE_RE.test(code)) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      // Well-formed but unknown code (or a bad locale) — use the fallback.
    }
  }

  try {
    const amount = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return code ? `${amount} ${code}` : amount;
  } catch {
    const amount = value.toFixed(2);
    return code ? `${amount} ${code}` : amount;
  }
}

// D-IMP-01: a tight, currency-symbol-less money label for calendar/heatmap cells
// where a full "€46,00" never fits. Whole units under 1k ("46"), then "k"/"M"
// with one decimal only while it adds information ("1,2k", "12k", "1,5M"). The
// decimal separator follows the locale (pt/es comma, en dot). Never throws.
const COMPACT_THOUSAND = 1000;
const COMPACT_MILLION = 1_000_000;

export function formatMoneyCompact(
  cents: number,
  locale: string = getActiveIntlLocale(),
): string {
  const sign = cents < 0 ? '-' : '';
  const value = Math.abs(fromCents(cents));
  const format = (n: number, maxFractionDigits: number): string => {
    try {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFractionDigits,
      }).format(n);
    } catch {
      return maxFractionDigits === 0 ? String(Math.round(n)) : n.toFixed(maxFractionDigits);
    }
  };

  const rounded = Math.round(value);
  if (rounded < COMPACT_THOUSAND) return sign + format(rounded, 0);
  if (value < COMPACT_MILLION) {
    const thousands = value / COMPACT_THOUSAND;
    return sign + format(thousands, thousands < 10 ? 1 : 0) + 'k';
  }
  const millions = value / COMPACT_MILLION;
  return sign + format(millions, millions < 10 ? 1 : 0) + 'M';
}

export function splitEqually(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) =>
    i < remainder ? base + 1 : base,
  );
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

export function centsPercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

export function subtractCents(a: number, b: number): number {
  return a - b;
}

export function addCents(a: number, b: number): number {
  return a + b;
}
