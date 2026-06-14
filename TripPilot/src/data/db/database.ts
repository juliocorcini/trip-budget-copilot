import Dexie, { type EntityTable } from 'dexie';
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5 } from './schema';
import { createDefaultAppSettings, createCurrentDevice } from './seed';
import { recordCrash } from '@/utils/crash-log';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { ScenarioPlan, ScenarioAllocationItem } from '@/domain/types/scenario';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PhaseProfileSetting } from '@/domain/types/phase-profile-setting';
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
import type { PeerLink } from '@/domain/types/peer-link';
import type { MirroredStatement } from '@/domain/types/mirrored-statement';
import type { LocalSnapshot } from '@/domain/types/local-snapshot';

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
  phaseProfileSettings!: EntityTable<PhaseProfileSetting, 'id'>;
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
  peerLinks!: EntityTable<PeerLink, 'id'>;
  mirroredStatements!: EntityTable<MirroredStatement, 'id'>;
  localSnapshots!: EntityTable<LocalSnapshot, 'id'>;

  constructor(name: string = 'TripPilotDB') {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2);

    // R2 unified migration (DEC-071/072/074/075). Defaults are permissive:
    // pre-existing data behaves exactly as before the upgrade.
    this.version(3)
      .stores(SCHEMA_V3)
      .upgrade(async (tx) => {
        await tx.table('participantShares').toCollection().modify((share) => {
          // DEC-071: existing shares are treated as already confirmed.
          if (share.confirmationStatus === undefined) share.confirmationStatus = 'confirmed';
        });
        await tx.table('phases').toCollection().modify((phase) => {
          if (phase.rhythmPreset === undefined) phase.rhythmPreset = null;
          if (phase.peakDays === undefined) phase.peakDays = null;
        });
        await tx.table('plannedOccurrences').toCollection().modify((occ) => {
          if (occ.endDate === undefined) occ.endDate = null;
          if (occ.kind === undefined) occ.kind = 'event';
          if (occ.reservedCents === undefined) occ.reservedCents = null;
          if (occ.linkedSessionId === undefined) occ.linkedSessionId = null;
        });
      });

    // R4 P2P sync (DEC-105/106): new pairing tables; existing participants
    // get the unlinked default.
    this.version(4)
      .stores(SCHEMA_V4)
      .upgrade(async (tx) => {
        await tx.table('participants').toCollection().modify((participant) => {
          if (participant.linkedActorId === undefined) participant.linkedActorId = null;
        });
      });

    // E6 (M14): local daily restore points. A new table needs no upgrade()
    // callback — existing tables/rows are preserved untouched on open.
    this.version(5).stores(SCHEMA_V5);

    // GAP-031: seed settings + current device on first open (fresh DBs only).
    this.on('populate', (tx) => {
      tx.table('appSettings').add(createDefaultAppSettings());
      tx.table('devices').add(createCurrentDevice());
    });
  }
}

export const db = new TripPilotDB();

// DEC-170: connection guards for the WebKit/multi-context failure family.
// `versionchange` fires when another context (a second tab, or a new deploy)
// needs to upgrade the schema. If we keep our older connection open it BLOCKS
// that upgrade, which hangs `db.open()` everywhere ("the database didn't
// respond"). Closing immediately lets the upgrade through; our next DB access
// transparently reopens at the new version. `blocked` means OUR upgrade is the
// one being held hostage — record it so the wedge is diagnosable in the crash
// buffer (the recovery ladder in db-recovery.ts owns the actual healing).
db.on('versionchange', () => {
  try {
    db.close();
  } catch {
    // Already closing — nothing to do.
  }
});
db.on('blocked', () => {
  recordCrash({ message: 'idb-blocked: schema upgrade held by another connection' });
});
