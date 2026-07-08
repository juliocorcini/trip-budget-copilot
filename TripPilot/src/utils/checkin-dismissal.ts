/**
 * Per-trip, per-day suppression of the daily check-in picker. When the user
 * closes the check-in picker without choosing a mode, the dismissal silences
 * it for the rest of the local day; it resurfaces the next day.
 * UI-only state in localStorage — never synced, never touches trip data.
 */
const KEY = 'tp:checkin-dismissed';

function storageKey(tripId: string): string {
  return `${KEY}:${tripId}`;
}

export function isCheckInDismissedToday(tripId: string, todayDate: string): boolean {
  try {
    return localStorage.getItem(storageKey(tripId)) === todayDate;
  } catch {
    return false;
  }
}

export function dismissCheckInToday(tripId: string, todayDate: string): void {
  try {
    localStorage.setItem(storageKey(tripId), todayDate);
  } catch {
    // Private mode / quota — the picker simply reappears, which is acceptable.
  }
}
