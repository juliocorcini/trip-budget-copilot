/**
 * BUG-005/BUG-018: every `localStorage` access can throw — iOS private mode,
 * blocked storage, or `QuotaExceededError`. Those throws used to bubble up
 * through getDeviceId, i.e. through EVERY create/update/delete, taking down a
 * simple "save expense". This helper is the single isolation point: it never
 * throws and falls back to an in-memory map that lasts for the session.
 *
 * Rule: nothing else in the app calls `localStorage.getItem/setItem` directly.
 */
const memoryFallback = new Map<string, string>();

export const safeLocalStorage = {
  get(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(key);
        if (value !== null) return value;
      }
    } catch {
      // Access threw — fall back to the in-memory copy below.
    }
    // localStorage was empty/unavailable: a prior set() may have failed to
    // persist but kept the value in memory, so it stays usable this session.
    return memoryFallback.get(key) ?? null;
  },

  set(key: string, value: string): void {
    // Always keep the in-memory copy so reads stay consistent within the
    // session even when persistence fails (and if localStorage starts
    // throwing mid-session, the value is still available).
    memoryFallback.set(key, value);
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
    } catch {
      // Persistence unavailable (private mode / quota) — memory fallback holds.
    }
  },

  remove(key: string): void {
    memoryFallback.delete(key);
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
    } catch {
      // Nothing to recover from — the value is gone from memory either way.
    }
  },
};
