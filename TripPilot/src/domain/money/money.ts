import { getActiveIntlLocale } from '@/domain/locale';

const CENTS_MULTIPLIER = 100;

export function toCents(value: number): number {
  return Math.round(value * CENTS_MULTIPLIER);
}

export function fromCents(cents: number): number {
  return cents / CENTS_MULTIPLIER;
}

// PAR-002 (R6-16): defaults to the active i18n language via the locale bridge,
// so the existing call sites follow the user's language without changes.
export function formatMoney(
  cents: number,
  currency: string,
  locale: string = getActiveIntlLocale(),
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(cents));
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
