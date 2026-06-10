import { useState, useEffect, useCallback } from 'react';
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
import { repairDemoTripIfNeeded } from '@/data/demo-repair';

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
  reload: () => Promise<void>;
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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { settings, trip, phases, pools, links, envelopes, transactions, wallets, participants, occurrences, loading, reload };
}
