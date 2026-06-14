import { db } from './database';
import { recordCrash } from '@/utils/crash-log';
import { safeLocalStorage } from '@/utils/safe-storage';

/**
 * DEC-170: IndexedDB connection resilience for the WebKit/iOS failure family.
 *
 * On iOS Safari / standalone PWAs the IndexedDB "server" process is killed by
 * the OS under memory pressure or on background→foreground transitions. Two
 * well-documented WebKit bugs bite us during heavy use (an active outing keeps
 * notifications + camera + frequent writes alive, then the app gets
 * backgrounded):
 *
 *   - 273827 / 277615 (iOS 17.4+): live queries start throwing
 *     "UnknownError: Connection to Indexed Database server lost". The handle is
 *     dead; `db.close()` + reopen alone recovers it in only ~1/3 of cases.
 *   - 2021 first-open hang: the very first `indexedDB.open()` stays `pending`
 *     forever and NO event fires (not even `onblocked`) → an infinite spinner /
 *     "the database didn't respond".
 *
 * The community consensus (Dexie maintainers, Odoo's POS fix, the Safari
 * Showstoppers log) is: detect the wedge and, when a close+reopen fails, do a
 * bounded `location.reload()` — the only reliable recovery. This module is the
 * single place that owns that escalation ladder so it can NEVER loop and the
 * user is NEVER left on a dead end.
 */

/** Open watchdog: a hung `db.open()` must fail loudly, not spin forever. */
const OPEN_TIMEOUT_MS = 8000;
/** Let WebKit settle between a close and the reopen attempt. */
const REOPEN_BACKOFF_MS = 400;

/**
 * The auto-reload budget. Persisted in localStorage (NOT memory) precisely so
 * it survives the reload it triggers — that is what makes a reload loop
 * impossible. After the budget is spent the UI takes over with manual recovery.
 */
const RELOAD_GUARD_KEY = 'trippilot.db-reload-guard';
const RELOAD_WINDOW_MS = 90_000;
const RELOAD_MAX = 3;

export class DbOpenTimeoutError extends Error {
  constructor() {
    super('IndexedDB open timed out (likely a WebKit connection wedge)');
    this.name = 'DbOpenTimeoutError';
  }
}

/**
 * True when the error looks like a lost/closing/wedged IndexedDB connection
 * rather than a logic error. Data-driven list of the signatures WebKit/Dexie
 * surface for this failure family (used for telemetry + recovery decisions).
 */
export function isConnectionLostError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? '';
  const message =
    (error as { message?: string } | null)?.message ?? String(error ?? '');
  const SIGNATURE_NAMES = new Set([
    'DatabaseClosedError',
    'UnknownError',
    'InvalidStateError',
    'AbortError',
    'DbOpenTimeoutError',
    'LoadTimeoutError',
  ]);
  if (SIGNATURE_NAMES.has(name)) return true;
  return /connection to indexed database server lost|need to reopen db|database connection is closing|unknownerror|the database connection is closing/i.test(
    message,
  );
}

function readReloadStamps(now: number): number[] {
  const raw = safeLocalStorage.get(RELOAD_GUARD_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n): n is number => typeof n === 'number')
      .filter((ts) => now - ts <= RELOAD_WINDOW_MS);
  } catch {
    return [];
  }
}

/** True while the bounded auto-reload budget for this window is not exhausted. */
export function canHardReload(now: number = Date.now()): boolean {
  return readReloadStamps(now).length < RELOAD_MAX;
}

/** Appends a reload stamp to the windowed budget. Exposed for tests. */
export function recordHardReload(now: number = Date.now()): void {
  const next = [...readReloadStamps(now), now].slice(-RELOAD_MAX);
  safeLocalStorage.set(RELOAD_GUARD_KEY, JSON.stringify(next));
}

/** Healthy load → reopen the auto-reload budget for any future incident. */
export function clearHardReloadGuard(): void {
  safeLocalStorage.remove(RELOAD_GUARD_KEY);
}

/** Best-effort full reload — the only reliable WebKit IDB recovery. */
export function hardReloadApp(): void {
  try {
    window.location.reload();
  } catch {
    // Test env / blocked navigation — nothing else we can do here.
  }
}

function safeCloseDb(): void {
  try {
    if (db.isOpen()) db.close();
  } catch {
    // Closing a wedged connection can itself throw — the reopen runs anyway.
  }
}

/**
 * Open the connection with a watchdog so a hung WebKit open can never spin
 * forever. Resolves when the DB is open; rejects on timeout or open error.
 */
export async function openWithWatchdog(
  timeoutMs: number = OPEN_TIMEOUT_MS,
): Promise<void> {
  if (db.isOpen()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DbOpenTimeoutError()), timeoutMs);
  });
  try {
    await Promise.race([db.open(), watchdog]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Tier 1 of the ladder: close the (possibly dead) handle and reopen it under
 * the watchdog. Returns true when the connection is healthy again. Never
 * throws. Does NOT reload — the caller decides whether to escalate.
 */
export async function recoverConnection(): Promise<boolean> {
  safeCloseDb();
  await new Promise((resolve) => setTimeout(resolve, REOPEN_BACKOFF_MS));
  try {
    await openWithWatchdog();
    return true;
  } catch (error) {
    recordCrash({
      message: `db-recovery: reopen failed — ${
        (error as Error)?.message ?? String(error)
      }`,
    });
    return false;
  }
}

/**
 * Tier 2 of the ladder: a bounded `location.reload()`. Returns true when it
 * actually triggers a reload (the page is about to go away). The budget guard
 * guarantees this can only fire a few times per window, so a permanently
 * wedged engine degrades to the manual recovery UI instead of a reload loop.
 *
 * `manual` (a deliberate user tap) is always allowed — it cannot auto-loop
 * because it needs a fresh tap each time — and refreshes telemetry.
 */
export function escalateToReload(options?: { manual?: boolean }): boolean {
  const manual = options?.manual ?? false;
  if (!manual && !canHardReload()) return false;
  recordHardReload();
  hardReloadApp();
  return true;
}
