import { useState, useEffect, useCallback, useRef } from 'react';
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

export function useAppData(): AppData {
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

  const retry = useCallback(async () => {
    try {
      if (db.isOpen()) db.close();
    } catch {
      // Closing a broken connection can throw — a fresh open follows anyway.
    }
    await reload();
  }, [reload]);

  useEffect(() => {
    reload();
  }, [reload]);

  // DEC-109: when the app returns to the foreground after a failed load,
  // try once automatically — the hung IndexedDB connection often recovers.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && errorRef.current) {
        retry();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [retry]);

  return { settings, trip, phases, pools, links, envelopes, transactions, wallets, participants, occurrences, loading, error, reload, retry };
}
