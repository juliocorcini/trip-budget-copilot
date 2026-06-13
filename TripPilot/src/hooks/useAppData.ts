import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
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
import { tripRepository, phaseRepository, budgetPoolRepository, budgetPoolPhaseLinkRepository, envelopeRepository, transactionRepository, walletRepository, participantRepository, appSettingsRepository, plannedOccurrenceRepository } from '@/data/repositories';
import { db } from '@/data/db/database';
import { repairDemoTripIfNeeded } from '@/data/demo-repair';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const errorRef = useRef(false);
  // BUG-019: throttle the automatic foreground retry.
  const lastAutoRetryAtRef = useRef(0);
  const autoRetryCountRef = useRef(0);

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
      return;
    }

    const [t, ph, po, tx, wa, pa, occ] = await Promise.all([
      tripRepository.getById(refreshedSettings.activeTrip),
      phaseRepository.getByTripId(refreshedSettings.activeTrip),
      budgetPoolRepository.getByTripId(refreshedSettings.activeTrip),
      transactionRepository.getByTripId(refreshedSettings.activeTrip),
      walletRepository.getByTripId(refreshedSettings.activeTrip),
      participantRepository.getByTripId(refreshedSettings.activeTrip),
      plannedOccurrenceRepository.getByTripId(refreshedSettings.activeTrip),
    ]);

    setTrip(t ?? null);
    setPhases(ph);
    setPools(po);
    setTransactions(tx);
    setWallets(wa);
    setParticipants(pa);
    setOccurrences(occ);

    const poolIds = po.map((p) => p.id);
    const [allLinks, allEnvelopes] = await Promise.all([
      Promise.all(poolIds.map((id) => budgetPoolPhaseLinkRepository.getByPoolId(id))),
      Promise.all(poolIds.map((id) => envelopeRepository.getByPoolId(id))),
    ]);
    setLinks(allLinks.flat());
    setEnvelopes(allEnvelopes.flat());
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await withTimeout(loadAll());
      errorRef.current = false;
      // BUG-019: a healthy load reopens the auto-retry budget.
      autoRetryCountRef.current = 0;
    } catch (err) {
      // DEC-109: keep whatever data was already in memory; flag the failure
      // so pages show the recovery screen instead of redirecting to /welcome.
      console.error('[useAppData] load failed:', err);
      errorRef.current = true;
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loadAll]);

  // DEC-109: manual recovery (DataErrorScreen button) is user-initiated, so the
  // aggressive close+reopen of a hung Dexie connection is warranted here — and
  // it resets the throttled auto-retry budget (BUG-019).
  const retry = useCallback(async () => {
    try {
      if (db.isOpen()) db.close();
    } catch {
      // Closing a broken connection can throw — a fresh open follows anyway.
    }
    lastAutoRetryAtRef.current = 0;
    autoRetryCountRef.current = 0;
    await reload();
  }, [reload]);

  useEffect(() => {
    reload();
  }, [reload]);

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
      reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  return { settings, trip, phases, pools, links, envelopes, transactions, wallets, participants, occurrences, loading, error, reload, retry };
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
