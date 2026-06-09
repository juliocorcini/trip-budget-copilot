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
import type { AppSettings } from '@/domain/types/app-settings';
import type { SyncMetadata } from '@/domain/types/common';

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
}

export const BACKUP_VERSION = 1;

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

  const tables: (keyof Omit<BackupData, 'version' | 'exportedAt' | 'deviceId' | 'appSettings'>)[] = [
    'trips', 'phases', 'budgetPools', 'budgetPoolPhaseLinks',
    'envelopes', 'participants', 'wallets', 'transactions',
    'participantShares', 'activityProfiles',
  ];

  for (const table of tables) {
    const localItems = local[table] as SyncMetadata[];
    const incomingItems = incoming[table] as SyncMetadata[];
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

export function parseBackupFile(jsonString: string): BackupData | null {
  try {
    const data = JSON.parse(jsonString) as BackupData;
    if (!data.version || !data.exportedAt) return null;
    return data;
  } catch {
    return null;
  }
}

export function generateBackupFilename(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16).replace(':', '');
  return `trippilot-backup-${date}-${time}.json`;
}
