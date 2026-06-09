import Dexie, { type EntityTable } from 'dexie';
import { SCHEMA_V1, SCHEMA_VERSION } from './schema';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { ScenarioPlan, ScenarioAllocationItem } from '@/domain/types/scenario';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Session, SessionItem } from '@/domain/types/session';
import type { Settlement } from '@/domain/types/settlement';
import type { ForecastSnapshot } from '@/domain/types/forecast-snapshot';
import type { FuturePhaseReservePolicy } from '@/domain/types/future-phase-reserve-policy';
import type { AlertRule } from '@/domain/types/alert-rule';
import type { AppSettings } from '@/domain/types/app-settings';
import type { Device } from '@/domain/types/device';

export class TripPilotDB extends Dexie {
  trips!: EntityTable<Trip, 'id'>;
  phases!: EntityTable<Phase, 'id'>;
  budgetPools!: EntityTable<BudgetPool, 'id'>;
  budgetPoolPhaseLinks!: EntityTable<BudgetPoolPhaseLink, 'id'>;
  envelopes!: EntityTable<Envelope, 'id'>;
  activityProfiles!: EntityTable<ActivityProfile, 'id'>;
  scenarioPlans!: EntityTable<ScenarioPlan, 'id'>;
  scenarioAllocationItems!: EntityTable<ScenarioAllocationItem, 'id'>;
  plannedOccurrences!: EntityTable<PlannedOccurrence, 'id'>;
  participants!: EntityTable<Participant, 'id'>;
  wallets!: EntityTable<Wallet, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  participantShares!: EntityTable<ParticipantShare, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sessionItems!: EntityTable<SessionItem, 'id'>;
  settlements!: EntityTable<Settlement, 'id'>;
  forecastSnapshots!: EntityTable<ForecastSnapshot, 'id'>;
  futurePhaseReservePolicies!: EntityTable<FuturePhaseReservePolicy, 'id'>;
  alertRules!: EntityTable<AlertRule, 'id'>;
  appSettings!: EntityTable<AppSettings, 'id'>;
  devices!: EntityTable<Device, 'id'>;

  constructor() {
    super('TripPilotDB');
    this.version(SCHEMA_VERSION).stores(SCHEMA_V1);
  }
}

export const db = new TripPilotDB();
