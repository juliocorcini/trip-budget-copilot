/**
 * DEC-423 (G8) — currency metadata for the pickers: which currencies lead the
 * list ("majors") and a flag emoji for a friendlier row. Pure + data-driven; the
 * human-readable NAME is resolved at the UI layer via `Intl.DisplayNames` so it is
 * localized (pt/en/es) for free, with no name table to maintain here.
 *
 * The base-anchored FX math is untouched — this only decides ORDER and DISPLAY.
 */

/**
 * The "majors" surfaced first in every currency picker, in this exact order
 * (Julio's confirmed default). Everything else follows alphabetically.
 */
export const MAJOR_CURRENCY_CODES = ['BRL', 'USD', 'EUR', 'CAD', 'CHF', 'GBP', 'JPY'] as const;

const MAJOR_INDEX: Record<string, number> = Object.fromEntries(
  MAJOR_CURRENCY_CODES.map((code, i) => [code, i]),
);

/**
 * Ordering rank: a major gets its fixed index (0..n); everything else gets
 * `Infinity` so the caller can break the tie alphabetically. Pure.
 */
export function currencyPriority(code: string): number {
  return MAJOR_INDEX[code.trim().toUpperCase()] ?? Number.POSITIVE_INFINITY;
}

/**
 * Order currency codes: majors first (in the fixed order above), then the rest
 * alphabetically. Does NOT dedupe/upper-case (the caller owns that) — it only
 * sorts, so a base-first list keeps its head and reorders the tail.
 */
export function sortByCurrencyPriority(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const pa = currencyPriority(a);
    const pb = currencyPriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

/**
 * A flag emoji for a currency code. The euro maps to the EU flag; otherwise the
 * ISO-4217 code's first two letters ARE the ISO-3166 country for the vast
 * majority (USD→US, GBP→GB, BRL→BR, CAD→CA, CHF→CH, JPY→JP, CZK→CZ…), turned into
 * regional-indicator symbols. Returns '' when the code can't map (e.g. XOF/XAF),
 * so the UI simply shows the code with no flag — never a wrong flag.
 */
export function currencyFlag(code: string): string {
  const c = code.trim().toUpperCase();
  if (c === 'EUR') return '\u{1F1EA}\u{1F1FA}'; // 🇪🇺
  if (!/^[A-Z]{3}$/.test(c)) return '';
  // ISO-4217 codes starting with 'X' are supranational (XOF/XAF/XCD) or non-country
  // (XAU/XDR) — no single flag, so show none rather than a wrong one.
  if (c.startsWith('X')) return '';
  const region = c.slice(0, 2);
  const A = 0x1f1e6; // regional indicator 'A'
  const first = A + (region.charCodeAt(0) - 65);
  const second = A + (region.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}
