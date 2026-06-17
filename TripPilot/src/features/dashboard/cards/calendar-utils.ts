/**
 * Wave B (F22): shared calendar helpers for the phase-map grids — the spending
 * heatmap and the "available per day" calendar render the same month scaffolding,
 * so the weekday header and month label live here once.
 */

/** Sunday-first narrow weekday letters in the active language. */
export function weekdayLetters(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  // 2023-01-01 was a Sunday; +i walks Sun..Sat.
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2023, 0, 1 + i, 12)));
}

/** "June 2026" style label for a YYYY-MM month key. */
export function monthLabel(monthIso: string, locale: string): string {
  const [year, month] = monthIso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year!, month! - 1, 1, 12),
  );
}
