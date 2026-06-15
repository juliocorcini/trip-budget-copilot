import { APP_VERSION } from './app-version';
import { SCHEMA_VERSION } from '@/data/db/schema';
import { readCrashLog } from './crash-log';
import { safeLocalStorage } from './safe-storage';
import { db } from '@/data/db/database';

/**
 * DEC-176: self-service field diagnostics. When the app is wedged on the
 * IndexedDB recovery screen there is NO console anyone can read on a mobile
 * PWA, so an incident is invisible. This collector reads ONLY sources that
 * survive a wedged DB (localStorage crash buffer, the Storage API, a raw
 * read-only IndexedDB probe) and renders one copy-pasteable text block so the
 * user can hand over real evidence instead of a screenshot. It must NEVER throw
 * and NEVER touch the (possibly hung) Dexie connection in a blocking way.
 */

const RELOAD_GUARD_KEY = 'trippilot.db-reload-guard';
const DB_NAME = 'TripPilotDB';
const PROBE_TIMEOUT_MS = 3000;

function formatBytes(bytes: number): string {
  if (!bytes) return '0';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;
}

async function describeStorage(): Promise<string> {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav?.storage?.estimate) return 'n/a';
    const est = await nav.storage.estimate();
    const usage = est.usage ?? 0;
    const quota = est.quota ?? 0;
    const pct = quota ? Math.round((usage / quota) * 100) : 0;
    let persisted: boolean | string = 'n/a';
    try {
      persisted = nav.storage.persisted ? await nav.storage.persisted() : 'n/a';
    } catch {
      persisted = 'error';
    }
    return `usage ${formatBytes(usage)} / quota ${formatBytes(quota)} (${pct}%), persisted=${persisted}`;
  } catch (e) {
    return `error: ${(e as Error)?.message ?? String(e)}`;
  }
}

async function listDatabases(): Promise<string> {
  try {
    if (typeof indexedDB === 'undefined' || !('databases' in indexedDB)) return 'n/a (API absent)';
    const dbs = (await Promise.race([
      (indexedDB.databases() as Promise<Array<{ name?: string; version?: number }>>),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS)),
    ])) as Array<{ name?: string; version?: number }>;
    if (!dbs.length) return '(none)';
    return dbs.map((d) => `${d.name ?? '?'}@v${d.version ?? '?'}`).join(', ');
  } catch (e) {
    return `error: ${(e as Error)?.message ?? String(e)}`;
  }
}

/**
 * Read-only probe of the actual on-disk database. Opens WITHOUT a version so it
 * can never trigger (or block) an upgrade — it just reports the live state that
 * is keeping us out: a clean open, a hard error (e.g. VersionError, corruption),
 * a `blocked` (another connection holds an older version — the multi-instance
 * upgrade wedge), or a hang (the WebKit "open stays pending forever" bug).
 */
async function probeOpen(): Promise<string> {
  return new Promise<string>((resolve) => {
    let settled = false;
    const finish = (msg: string) => {
      if (settled) return;
      settled = true;
      resolve(msg);
    };
    const timer = setTimeout(
      () => finish('TIMEOUT — open stayed pending (WebKit first-open hang or blocked upgrade)'),
      PROBE_TIMEOUT_MS,
    );
    try {
      if (typeof indexedDB === 'undefined') {
        clearTimeout(timer);
        finish('n/a (indexedDB absent)');
        return;
      }
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        clearTimeout(timer);
        const version = req.result?.version ?? '?';
        try {
          req.result.close();
        } catch {
          // ignore
        }
        finish(`ok (on-disk v${version})`);
      };
      req.onerror = () => {
        clearTimeout(timer);
        finish(`ERROR ${req.error?.name ?? 'unknown'} — ${req.error?.message ?? ''}`);
      };
      req.onblocked = () => {
        clearTimeout(timer);
        finish('BLOCKED — another open connection holds an older version (multi-instance upgrade wedge)');
      };
    } catch (e) {
      clearTimeout(timer);
      finish(`THREW ${(e as Error)?.name ?? ''}: ${(e as Error)?.message ?? String(e)}`);
    }
  });
}

function describeEnvironment(): string {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const win = typeof window !== 'undefined' ? window : null;
  const standalone =
    win?.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone' : 'browser';
  return [
    `app ${APP_VERSION}  schema(target) v${SCHEMA_VERSION}  dexie verno ${safeVerno()}  dexie isOpen ${safeIsOpen()}`,
    `display ${standalone}  online ${nav?.onLine ?? 'n/a'}  lang ${nav?.language ?? 'n/a'}`,
    `platform ${(nav as { platform?: string } | null)?.platform ?? 'n/a'}`,
    `UA ${nav?.userAgent ?? 'n/a'}`,
  ].join('\n');
}

function safeVerno(): string {
  try {
    return String(db.verno);
  } catch {
    return '?';
  }
}

function safeIsOpen(): string {
  try {
    return String(db.isOpen());
  } catch {
    return '?';
  }
}

function describeReloadGuard(): string {
  const raw = safeLocalStorage.get(RELOAD_GUARD_KEY);
  if (!raw) return '(none)';
  return raw;
}

function describeCrashLog(): string {
  const entries = readCrashLog();
  if (!entries.length) return '(empty — no crashes recorded)';
  return entries
    .map((e) => {
      const time = new Date(e.timestamp).toISOString();
      const firstStack = e.stack ? `\n    ${e.stack.split('\n')[0]?.trim()}` : '';
      return `[${time}] ${e.message}${firstStack}`;
    })
    .join('\n');
}

/**
 * Builds the full human-readable diagnostics block. Resolves even if every
 * probe fails. Order: environment → storage → IndexedDB state → recovery
 * budget → the crash buffer (the actual errors that wedged us).
 */
export async function collectDiagnostics(): Promise<string> {
  const [storage, databases, openProbe] = await Promise.all([
    describeStorage(),
    listDatabases(),
    probeOpen(),
  ]);
  return [
    '===== TripPilot diagnostics =====',
    `generated ${new Date().toISOString()}`,
    '',
    '--- environment ---',
    describeEnvironment(),
    '',
    '--- storage ---',
    storage,
    '',
    '--- indexedDB ---',
    `databases: ${databases}`,
    `open probe: ${openProbe}`,
    '',
    '--- recovery budget (db-reload-guard) ---',
    describeReloadGuard(),
    '',
    '--- crash log (most recent last) ---',
    describeCrashLog(),
    '================================',
  ].join('\n');
}
