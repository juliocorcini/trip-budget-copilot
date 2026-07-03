import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { logger } from '@/utils/logger';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import type { Wallet } from '@/domain/types/wallet';
import type { Participant } from '@/domain/types/participant';
import type { AppSettings } from '@/domain/types/app-settings';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import { tripRepository, phaseRepository, budgetPoolRepository, budgetPoolPhaseLinkRepository, envelopeRepository, transactionRepository, walletRepository, participantRepository, appSettingsRepository, plannedOccurrenceRepository, plannedPurchaseRepository } from '@/data/repositories';
import {
  openWithWatchdog,
  recoverConnection,
  escalateToReload,
  clearHardReloadGuard,
} from '@/data/db/db-recovery';
import { recordCrash, describeError } from '@/utils/crash-log';
import { repairDemoTripIfNeeded } from '@/data/demo-repair';
import { isFxSnapshotStale } from '@/domain/money';
import { fetchExchangeRates } from '@/utils/exchange-rates';
import { isOnline } from '@/utils/places';

// DEC-109: if IndexedDB hangs (known WebKit issue in standalone PWAs after
// share-sheet/backgrounding), the load must fail loudly instead of leaving
// the app on an infinite "loading" screen.
const LOAD_TIMEOUT_MS = 10000;

// BUG-019: the foreground auto-retry must not storm the DB when it stays
// broken. Cap to one attempt per cooldown window and stop after a few tries —
// the manual retry on DataErrorScreen always works and resets the cycle.
const AUTO_RETRY_COOLDOWN_MS = 30000;
const AUTO_RETRY_MAX_ATTEMPTS = 3;

/**
 * DEC-126: data written outside the mounted page's own flow (undo toast after
 * navigation, SW direct writes) announces itself here so every mounted
 * useAppData refreshes. Mirrors the OUTING_CHANGED_EVENT pattern.
 */
export const APP_DATA_CHANGED_EVENT = 'trippilot:data-changed';

export function notifyAppDataChanged(): void {
  window.dispatchEvent(new CustomEvent(APP_DATA_CHANGED_EVENT));
}

class LoadTimeoutError extends Error {
  constructor() {
    super('App data load timed out');
    this.name = 'LoadTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LoadTimeoutError()), LOAD_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

interface AppData {
  settings: AppSettings | null;
  trip: Trip | null;
  phases: Phase[];
  pools: BudgetPool[];
  links: BudgetPoolPhaseLink[];
  envelopes: Envelope[];
  transactions: Transaction[];
  wallets: Wallet[];
  participants: Participant[];
  occurrences: PlannedOccurrence[];
  plannedPurchases: PlannedPurchase[];
  loading: boolean;
  /** DEC-109: true when the DB read failed/hung — NEVER treat as empty data. */
  error: boolean;
  reload: () => Promise<void>;
  /** DEC-109: recovery action — closes the Dexie connection and reloads. */
  retry: () => Promise<void>;
}

// BUG-007: the loader runs ONCE inside AppDataProvider; consumers read the
// shared snapshot through context. Kept exported so the unit tests can drive
// the loader in isolation.
export function useAppDataState(): AppData {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [pools, setPools] = useState<BudgetPool[]>([]);
  const [links, setLinks] = useState<BudgetPoolPhaseLink[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [occurrences, setOccurrences] = useState<PlannedOccurrence[]>([]);
  const [plannedPurchases, setPlannedPurchases] = useState<PlannedPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const errorRef = useRef(false);
  // BUG-019: throttle the automatic foreground retry.
  const lastAutoRetryAtRef = useRef(0);
  const autoRetryCountRef = useRef(0);
  // DEC-434: warm the FX snapshot at most once per mount.
  const fxWarmedRef = useRef(false);

  const loadAll = useCallback(async () => {
    const s = await appSettingsRepository.get();
    await repairDemoTripIfNeeded(s);
    const refreshedSettings = await appSettingsRepository.get();
    setSettings(refreshedSettings);

    if (!refreshedSettings.activeTrip) {
      setTrip(null);
      setPhases([]);
      setPools([]);
      setLinks([]);
      setEnvelopes([]);
      setTransactions([]);
      setWallets([]);
      setParticipants([]);
      setOccurrences([]);
      setPlannedPurchases([]);
      return;
    }

    const [t, ph, po, tx, wa, pa, occ, pp] = await Promise.all([
      tripRepository.getById(refreshedSettings.activeTrip),
      phaseRepository.getByTripId(refreshedSettings.activeTrip),
      budgetPoolRepository.getByTripId(refreshedSettings.activeTrip),
      transactionRepository.getByTripId(refreshedSettings.activeTrip),
      walletRepository.getByTripId(refreshedSettings.activeTrip),
      participantRepository.getByTripId(refreshedSettings.activeTrip),
      plannedOccurrenceRepository.getByTripId(refreshedSettings.activeTrip),
      plannedPurchaseRepository.getByTripId(refreshedSettings.activeTrip),
    ]);

    setTrip(t ?? null);
    setPhases(ph);
    setPools(po);
    setTransactions(tx);
    setWallets(wa);
    setParticipants(pa);
    setOccurrences(occ);
    setPlannedPurchases(pp);

    const poolIds = po.map((p) => p.id);
    const [allLinks, allEnvelopes] = await Promise.all([
      Promise.all(poolIds.map((id) => budgetPoolPhaseLinkRepository.getByPoolId(id))),
      Promise.all(poolIds.map((id) => envelopeRepository.getByPoolId(id))),
    ]);
    setLinks(allLinks.flat());
    setEnvelopes(allEnvelopes.flat());
  }, []);

  // DEC-170: tier-1 self-heal — close the (possibly dead WebKit) handle, reopen
  // it under the watchdog, then re-read. Shared by the automatic recovery path
  // and the manual retry. Never reloads the page here; escalation is a bounded
  // decision made by the caller. Returns true when the data is healthy again.
  const reopenAndReload = useCallback(async (): Promise<boolean> => {
    const reopened = await recoverConnection();
    if (!reopened) return false;
    try {
      await withTimeout(loadAll());
      return true;
    } catch (err) {
      logger.error('app_data_reload_failed', { module: 'useAppData' }, err);
      return false;
    }
  }, [loadAll]);

  // UX/continuity: a background refresh must NOT blank the screen. Only the
  // first load and explicit recovery flip `loading` (which gates the full-screen
  // loader); every in-page mutation reloads SILENTLY so the component tree stays
  // mounted and the scroll position is preserved — no "page reloaded / jumped to
  // top" feeling. `loadAll`'s setState calls re-render the new data in place.
  const runLoad = useCallback(
    async (options?: { showLoading?: boolean }) => {
      if (options?.showLoading) setLoading(true);
      setError(false);
      try {
        // DEC-170: a hung WebKit `open()` must fail fast (watchdog) instead of
        // spinning forever — the catch then runs the recovery ladder.
        await openWithWatchdog();
        await withTimeout(loadAll());
        errorRef.current = false;
        // BUG-019: a healthy load reopens the auto-retry budget.
        autoRetryCountRef.current = 0;
        // DEC-170: healthy → reopen the bounded auto-reload budget too.
        clearHardReloadGuard();
        setLoading(false);
      } catch (err) {
        // DEC-109/DEC-170: don't dead-end. First self-heal (close+reopen+re-read);
        // if that fails, escalate to a bounded `location.reload()` — per the
        // WebKit IDB bug it is the only reliable recovery, it is invisible-ish
        // ("blink"), and the budget guard makes a reload loop impossible. Only
        // when even that is spent do we flag the error so the recovery screen
        // shows (never a redirect to the destructive /welcome).
        logger.error('app_data_load_failed', { module: 'useAppData' }, err);
        // DEC-176: ALWAYS leave a trace. The old ladder only recorded a crash
        // when a reopen FAILED, so a transient wedge that self-healed left the
        // diagnostics empty — which is exactly why a recurring incident was
        // invisible. Record the real error name+message up front so the next
        // "Copy diagnostics" shows the actual cause even when recovery wins.
        const described = describeError(err);
        recordCrash({
          message: `idb load failed: ${described.message}`,
          stack: described.stack,
        });
        const healed = await reopenAndReload();
        if (healed) {
          errorRef.current = false;
          autoRetryCountRef.current = 0;
          clearHardReloadGuard();
          setLoading(false);
        } else if (escalateToReload()) {
          // The page is reloading — keep the loader up so nothing flashes.
        } else {
          recordCrash({ message: 'idb load: recovery exhausted — showing recovery screen' });
          errorRef.current = true;
          setError(true);
          setLoading(false);
        }
      }
    },
    [loadAll, reopenAndReload],
  );

  // Exposed refresh used by every in-page mutation — silent (no loader flash).
  const reload = useCallback(() => runLoad(), [runLoad]);

  // DEC-109/DEC-170: manual recovery (DataErrorScreen "try again" + its silent
  // background auto-retry). Close+reopen the connection and re-read; the page
  // reload escape lives as an explicit button on the screen so this stays cheap
  // and non-disruptive when fired repeatedly in the background.
  const retry = useCallback(async () => {
    setLoading(true);
    setError(false);
    lastAutoRetryAtRef.current = 0;
    autoRetryCountRef.current = 0;
    const healed = await reopenAndReload();
    errorRef.current = !healed;
    if (healed) clearHardReloadGuard();
    setError(!healed);
    setLoading(false);
  }, [reopenAndReload]);

  useEffect(() => {
    // First load shows the full-screen loader.
    runLoad({ showLoading: true });
  }, [runLoad]);

  // DEC-434: keep the FX snapshot fresh app-wide so the converter, the "ver na
  // minha moeda" hint and foreign-currency entry always show a current AUTO rate
  // without a manual tap. Best-effort + offline-safe: gated on online + staleness
  // (>12h; a missing snapshot counts as stale), the network boundary swallows
  // every failure, and it runs at most once per mount. Extends the converter-only
  // warm-up (DEC-423) to the whole app; updates settings in place (no reload).
  useEffect(() => {
    if (fxWarmedRef.current || !trip) return;
    fxWarmedRef.current = true;
    const base = trip.baseCurrency;
    if (!base || !isOnline()) return;
    if (!isFxSnapshotStale(settings?.frozenRates ?? null, new Date())) return;
    void (async () => {
      const rates = await fetchExchangeRates(base);
      if (rates) {
        await appSettingsRepository.update({ frozenRates: rates });
        setSettings((prev) => (prev ? { ...prev, frozenRates: rates } : prev));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, settings]);

  // DEC-126: refresh when another surface (undo toast, SW) changed the data.
  useEffect(() => {
    const onDataChanged = () => {
      reload();
    };
    window.addEventListener(APP_DATA_CHANGED_EVENT, onDataChanged);
    return () => window.removeEventListener(APP_DATA_CHANGED_EVENT, onDataChanged);
  }, [reload]);

  // DEC-109: when the app returns to the foreground after a failed load, try
  // automatically — the hung IndexedDB connection often recovers. BUG-019:
  // throttle to one lightweight reload per cooldown and stop after a few
  // attempts so a persistently broken DB never storms close/open in a loop.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !errorRef.current) return;
      const now = Date.now();
      if (now - lastAutoRetryAtRef.current < AUTO_RETRY_COOLDOWN_MS) return;
      if (autoRetryCountRef.current >= AUTO_RETRY_MAX_ATTEMPTS) return;
      lastAutoRetryAtRef.current = now;
      autoRetryCountRef.current += 1;
      // Prefer a plain re-load over close+reopen in the foreground (risky).
      // Show the loader so a half-loaded error state never flashes /welcome.
      runLoad({ showLoading: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runLoad]);

  // DEC-176 (Android stability): when a page is restored from the back/forward
  // cache, Chrome has CLOSED our IndexedDB connection while the JS still thinks
  // it is open — the next read then fails ("couldn't load your data") even
  // though the DB is perfectly healthy. This is the most likely cause of the
  // recurring transient wedge on installed Android PWAs. A `pageshow` with
  // `persisted` means a bfcache restore: re-read SILENTLY so the ladder
  // (open watchdog → close+reopen) revives the stale handle before the user
  // ever taps anything. No loader flash; healthy data returns in place.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reload();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [reload]);

  return { settings, trip, phases, pools, links, envelopes, transactions, wallets, participants, occurrences, plannedPurchases, loading, error, reload, retry };
}

// BUG-007: single shared snapshot of app data. The Provider (in RootLayout)
// runs the loader once; every `useAppData()` call site reads the same context.
export const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return ctx;
}
