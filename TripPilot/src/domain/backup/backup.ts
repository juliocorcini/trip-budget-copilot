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
import type { PhaseProfileSetting } from '@/domain/types/phase-profile-setting';
import type { ForecastSnapshot } from '@/domain/types/forecast-snapshot';
import type { FuturePhaseReservePolicy } from '@/domain/types/future-phase-reserve-policy';
import type { AlertRule } from '@/domain/types/alert-rule';
import type { Device } from '@/domain/types/device';
import type { AppSettings } from '@/domain/types/app-settings';
import type { PeerLink } from '@/domain/types/peer-link';
import type { MirroredStatement } from '@/domain/types/mirrored-statement';
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
  phaseProfileSettings: PhaseProfileSetting[];
  forecastSnapshots: ForecastSnapshot[];
  futurePhaseReservePolicies: FuturePhaseReservePolicy[];
  alertRules: AlertRule[];
  devices: Device[];
  peerLinks: PeerLink[];
  mirroredStatements: MirroredStatement[];
}

/**
 * v5 (E8, Phase 5): adds Transaction location fields (placeLabel, latitude,
 * longitude, placeId — all nullable). v1-v4 files import with missing tables as
 * empty and missing fields normalized to the migration defaults (location null).
 */
export const BACKUP_VERSION = 5;

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
  'phaseProfileSettings',
  'forecastSnapshots',
  'futurePhaseReservePolicies',
  'alertRules',
  'devices',
  'peerLinks',
  'mirroredStatements',
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
 * Normalizes pre-v3 backup records to the v3 shape — same defaults as the
 * Dexie v3 upgrade(), so importing an old file never changes behavior.
 */
export function normalizeBackupToV3(data: BackupData): BackupData {
  return {
    ...data,
    participantShares: data.participantShares.map((s) => ({
      ...s,
      confirmationStatus: s.confirmationStatus ?? ('confirmed' as const),
    })),
    phases: data.phases.map((p) => ({
      ...p,
      rhythmPreset: p.rhythmPreset ?? null,
      peakDays: p.peakDays ?? null,
    })),
    plannedOccurrences: data.plannedOccurrences.map((o) => ({
      ...o,
      endDate: o.endDate ?? null,
      kind: o.kind ?? ('event' as const),
      reservedCents: o.reservedCents ?? null,
      linkedSessionId: o.linkedSessionId ?? null,
    })),
    phaseProfileSettings: data.phaseProfileSettings ?? [],
  };
}

/**
 * Normalizes pre-v4 backup records — same defaults as the Dexie v4
 * upgrade(): new pairing tables empty, participants unlinked.
 */
export function normalizeBackupToV4(data: BackupData): BackupData {
  const v3 = normalizeBackupToV3(data);
  return {
    ...v3,
    participants: v3.participants.map((p) => ({
      ...p,
      linkedActorId: p.linkedActorId ?? null,
    })),
    peerLinks: v3.peerLinks ?? [],
    mirroredStatements: v3.mirroredStatements ?? [],
  };
}

/**
 * Normalizes pre-v5 backup records — same defaults as the Phase 5 field
 * additions: every transaction gets null location fields (placeLabel,
 * latitude, longitude, placeId), so an older file never changes behavior.
 */
export function normalizeBackupToV5(data: BackupData): BackupData {
  const v4 = normalizeBackupToV4(data);
  return {
    ...v4,
    transactions: v4.transactions.map((t) => ({
      ...t,
      placeLabel: t.placeLabel ?? null,
      latitude: t.latitude ?? null,
      longitude: t.longitude ?? null,
      placeId: t.placeId ?? null,
    })),
  };
}

/**
 * GAP-029: validates the file against the Zod schemas before anything is
 * written. Malformed files yield a clear error and zero partial writes.
 * v1 files (missing tables) are normalized with empty arrays; older files get
 * the field defaults up to the current version (normalizeBackupToV5).
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
  return { data: normalizeBackupToV5(result.data as unknown as BackupData), error: null };
}

export function parseBackupFile(jsonString: string): BackupData | null {
  return parseBackupFileSafe(jsonString).data;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * DEC-057 (decision D-J): the backup reminder fires when the last export is
 * older than the configured interval (a never-backed-up app counts as due).
 */
export function isBackupReminderDue(
  settings: Pick<AppSettings, 'backupReminderEnabled' | 'backupReminderDays' | 'lastBackupDate'>,
  nowMs: number,
): boolean {
  if (!settings.backupReminderEnabled) return false;
  if (settings.lastBackupDate === null) return true;
  const elapsedDays = (nowMs - new Date(settings.lastBackupDate).getTime()) / MS_PER_DAY;
  return elapsedDays > settings.backupReminderDays;
}

export function generateBackupFilename(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16).replace(':', '');
  return `trippilot-backup-${date}-${time}.json`;
}
