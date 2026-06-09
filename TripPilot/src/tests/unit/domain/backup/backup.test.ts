import { describe, it, expect } from 'vitest';
import {
  createBackup,
  analyzeImport,
  mergeBackupData,
  parseBackupFile,
  generateBackupFilename,
  isBackupReminderDue,
} from '@/domain/backup';
import type { BackupData } from '@/domain/backup';
import type { SyncMetadata } from '@/domain/types/common';

const emptyBackup = (deviceId: string = 'dev-1'): Omit<BackupData, 'version' | 'exportedAt'> => ({
  deviceId,
  appSettings: {
    id: 'app-settings',
    activeTrip: null,
    alertTone: 'amigo_sincero',
    defaultCurrency: 'EUR',
    themePreference: 'dark',
    language: 'pt-BR',
    vibrationEnabled: true,
    backupReminderEnabled: true,
    backupReminderDays: 3,
    lastBackupDate: null,
    deviceName: 'Test',
    persistentStorageGranted: false,
    isDemo: false,
    onboardingCompleted: false,
    quickAddDefaultValuesCents: [300, 500, 1000],
  },
  trips: [],
  phases: [],
  budgetPools: [],
  budgetPoolPhaseLinks: [],
  envelopes: [],
  participants: [],
  wallets: [],
  transactions: [],
  participantShares: [],
  activityProfiles: [],
  sessions: [],
  sessionItems: [],
  settlements: [],
  scenarioPlans: [],
  scenarioAllocationItems: [],
  plannedOccurrences: [],
  forecastSnapshots: [],
  futurePhaseReservePolicies: [],
  alertRules: [],
  devices: [],
});

describe('createBackup', () => {
  it('adds version and export date', () => {
    const backup = createBackup(emptyBackup());
    expect(backup.version).toBe(2);
    expect(backup.exportedAt).toBeTruthy();
  });
});

describe('analyzeImport', () => {
  it('detects new records', () => {
    const local = createBackup(emptyBackup());
    const incoming = createBackup({
      ...emptyBackup('dev-2'),
      trips: [{ id: '4f9c20de-9e94-4f0b-8a3e-111111111111', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, revision: 1, sourceDeviceId: '4f9c20de-9e94-4f0b-8a3e-222222222222', name: 'Test', baseCurrency: 'EUR', startDate: '2026-01-01', endDate: '2026-01-31', status: 'active', notes: null }],
    });
    const analysis = analyzeImport(local, incoming);
    expect(analysis.newRecords).toBe(1);
    expect(analysis.totalRecords).toBe(1);
  });
});

describe('mergeBackupData', () => {
  it('prefers higher revision', () => {
    const local: SyncMetadata[] = [
      { id: '1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, revision: 1, sourceDeviceId: 'a' },
    ];
    const incoming: SyncMetadata[] = [
      { id: '1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletedAt: null, revision: 2, sourceDeviceId: 'b' },
    ];
    const merged = mergeBackupData(local, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.revision).toBe(2);
  });

  it('adds new records from incoming', () => {
    const local: SyncMetadata[] = [
      { id: '1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, revision: 1, sourceDeviceId: 'a' },
    ];
    const incoming: SyncMetadata[] = [
      { id: '2', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, revision: 1, sourceDeviceId: 'b' },
    ];
    const merged = mergeBackupData(local, incoming);
    expect(merged).toHaveLength(2);
  });
});

describe('parseBackupFile', () => {
  it('parses valid JSON backup', () => {
    const backup = createBackup(emptyBackup());
    const result = parseBackupFile(JSON.stringify(backup));
    expect(result).not.toBeNull();
    expect(result!.version).toBe(2);
  });

  it('returns null for invalid JSON', () => {
    expect(parseBackupFile('not json')).toBeNull();
  });

  it('returns null for missing version', () => {
    expect(parseBackupFile('{"exportedAt":"2026"}')).toBeNull();
  });

  it('normalizes v1 files: missing tables become empty arrays (GAP-003)', () => {
    const v1 = {
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      deviceId: 'dev-1',
      appSettings: { id: 'app-settings' },
      trips: [],
      phases: [],
    };
    const result = parseBackupFile(JSON.stringify(v1));
    expect(result).not.toBeNull();
    expect(result!.sessions).toEqual([]);
    expect(result!.settlements).toEqual([]);
    expect(result!.devices).toEqual([]);
  });

  it('rejects structurally invalid records with a clear error (GAP-029)', () => {
    const malformed = {
      version: 2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      deviceId: 'dev-1',
      appSettings: { id: 'app-settings' },
      transactions: [{ id: 'not-a-uuid', amountCents: 'oops' }],
    };
    expect(parseBackupFile(JSON.stringify(malformed))).toBeNull();
  });
});

describe('isBackupReminderDue', () => {
  const now = new Date('2026-06-09T12:00:00Z').getTime();
  const base = { backupReminderEnabled: true, backupReminderDays: 7 };

  it('is not due when reminders are disabled', () => {
    expect(isBackupReminderDue({ ...base, backupReminderEnabled: false, lastBackupDate: null }, now)).toBe(false);
  });

  it('is due when no backup was ever made', () => {
    expect(isBackupReminderDue({ ...base, lastBackupDate: null }, now)).toBe(true);
  });

  it('is due when the last backup is older than the interval', () => {
    expect(isBackupReminderDue({ ...base, lastBackupDate: '2026-05-30T12:00:00Z' }, now)).toBe(true);
  });

  it('is not due when the last backup is within the interval', () => {
    expect(isBackupReminderDue({ ...base, lastBackupDate: '2026-06-05T12:00:00Z' }, now)).toBe(false);
  });
});

describe('generateBackupFilename', () => {
  it('generates filename with date', () => {
    const name = generateBackupFilename();
    expect(name).toMatch(/^trippilot-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  });
});
