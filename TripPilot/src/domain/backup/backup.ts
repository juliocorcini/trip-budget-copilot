import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Session, SessionItem } from '@/domain/types/session';
import type { Settlement } from '@/domain/types/settlement';
import type { ScenarioPlan, ScenarioAllocationItem } from '@/domain/types/scenario';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { ForecastSnapshot } from '@/domain/types/forecast-snapshot';
import type { FuturePhaseReservePolicy } from '@/domain/types/future-phase-reserve-policy';
import type { AlertRule } from '@/domain/types/alert-rule';
import type { Device } from '@/domain/types/device';
import type { AppSettings } from '@/domain/types/app-settings';
import type { SyncMetadata } from '@/domain/types/common';
import { backupFileSchema } from '@/domain/validation/schemas';

export interface BackupData {
  version: number;
  exportedAt: string;
  deviceId: string;
  appSettings: AppSettings;
  trips: Trip[];
  phases: Phase[];
  budgetPools: BudgetPool[];
  budgetPoolPhaseLinks: BudgetPoolPhaseLink[];
  envelopes: Envelope[];
  participants: Participant[];
  wallets: Wallet[];
  transactions: Transaction[];
  participantShares: ParticipantShare[];
  activityProfiles: ActivityProfile[];
  sessions: Session[];
  sessionItems: SessionItem[];
  settlements: Settlement[];
  scenarioPlans: ScenarioPlan[];
  scenarioAllocationItems: ScenarioAllocationItem[];
  plannedOccurrences: PlannedOccurrence[];
  forecastSnapshots: ForecastSnapshot[];
  futurePhaseReservePolicies: FuturePhaseReservePolicy[];
  alertRules: AlertRule[];
  devices: Device[];
}

/** v2: full 21-table coverage (GAP-003). v1 files import with missing tables as empty. */
export const BACKUP_VERSION = 2;

export type BackupTableKey = keyof Omit<
  BackupData,
  'version' | 'exportedAt' | 'deviceId' | 'appSettings'
>;

export const BACKUP_TABLE_KEYS: BackupTableKey[] = [
  'trips',
  'phases',
  'budgetPools',
  'budgetPoolPhaseLinks',
  'envelopes',
  'participants',
  'wallets',
  'transactions',
  'participantShares',
  'activityProfiles',
  'sessions',
  'sessionItems',
  'settlements',
  'scenarioPlans',
  'scenarioAllocationItems',
  'plannedOccurrences',
  'forecastSnapshots',
  'futurePhaseReservePolicies',
  'alertRules',
  'devices',
];

export function createBackup(data: Omit<BackupData, 'version' | 'exportedAt'>): BackupData {
  return {
    ...data,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
  };
}

export interface ImportAnalysis {
  newRecords: number;
  updatedRecords: number;
  conflicts: number;
  totalRecords: number;
}

export function analyzeImport(
  local: BackupData,
  incoming: BackupData,
): ImportAnalysis {
  let newRecords = 0;
  let updatedRecords = 0;
  let conflicts = 0;

  for (const table of BACKUP_TABLE_KEYS) {
    const localItems = (local[table] ?? []) as SyncMetadata[];
    const incomingItems = (incoming[table] ?? []) as SyncMetadata[];
    const localMap = new Map(localItems.map((i) => [i.id, i]));

    for (const item of incomingItems) {
      const localItem = localMap.get(item.id);
      if (!localItem) {
        newRecords++;
      } else if (item.revision > localItem.revision) {
        updatedRecords++;
      } else if (
        item.revision === localItem.revision &&
        item.updatedAt !== localItem.updatedAt
      ) {
        conflicts++;
      }
    }
  }

  return {
    newRecords,
    updatedRecords,
    conflicts,
    totalRecords: newRecords + updatedRecords + conflicts,
  };
}

export function mergeBackupData<T extends SyncMetadata>(
  local: T[],
  incoming: T[],
): T[] {
  const merged = new Map<string, T>();
  for (const item of local) {
    merged.set(item.id, item);
  }
  for (const item of incoming) {
    const existing = merged.get(item.id);
    if (!existing || item.revision > existing.revision) {
      merged.set(item.id, item);
    } else if (
      item.revision === existing.revision &&
      item.updatedAt > existing.updatedAt
    ) {
      merged.set(item.id, item);
    }
  }
  return Array.from(merged.values());
}

export interface ParseBackupResult {
  data: BackupData | null;
  error: string | null;
}

/**
 * GAP-029: validates the file against the Zod schemas before anything is
 * written. Malformed files yield a clear error and zero partial writes.
 * v1 files (missing tables) are normalized with empty arrays.
 */
export function parseBackupFileSafe(jsonString: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    return { data: null, error: 'invalid_json' };
  }

  const result = backupFileSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      data: null,
      error: first ? `${first.path.join('.')}: ${first.message}` : 'invalid_schema',
    };
  }
  return { data: result.data as unknown as BackupData, error: null };
}

export function parseBackupFile(jsonString: string): BackupData | null {
  return parseBackupFileSafe(jsonString).data;
}

export function generateBackupFilename(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16).replace(':', '');
  return `trippilot-backup-${date}-${time}.json`;
}
