/**
 * C2: per-trip, per-day suppression of the "open an Outing?" nudge. Dismissing
 * it silences the hint for the rest of the local day; it can resurface the next
 * day if the pattern repeats. UI-only state in localStorage — never synced and
 * never touches trip data (ÂNCORA 9).
 */
const KEY_PREFIX = 'tp:outing-suggest-dismissed:';

function storageKey(tripId: string): string {
  return `${KEY_PREFIX}${tripId}`;
}

/** True when the nudge was already dismissed for `todayDate` (local YYYY-MM-DD). */
export function isOutingSuggestionDismissed(tripId: string, todayDate: string): boolean {
  try {
    return localStorage.getItem(storageKey(tripId)) === todayDate;
  } catch {
    return false;
  }
}

/** Silence the nudge for the rest of `todayDate`. */
export function dismissOutingSuggestion(tripId: string, todayDate: string): void {
  try {
    localStorage.setItem(storageKey(tripId), todayDate);
  } catch {
    // Private mode / quota — the nudge simply reappears, which is acceptable.
  }
}
