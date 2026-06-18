import { describe, it, expect } from 'vitest';
import { normalizeBackupToV5, BACKUP_VERSION, type BackupData } from '@/domain/backup';

const EMPTY_TABLES = {
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
  plannedPurchases: [],
  phaseProfileSettings: [],
  forecastSnapshots: [],
  futurePhaseReservePolicies: [],
  alertRules: [],
  devices: [],
  peerLinks: [],
  mirroredStatements: [],
  splitSessions: [],
};

function makeBackup(transactions: unknown[]): BackupData {
  return {
    version: 4,
    exportedAt: '2026-01-01T00:00:00.000Z',
    deviceId: 'dev-1',
    appSettings: { id: 'app-settings' } as unknown as BackupData['appSettings'],
    ...EMPTY_TABLES,
    transactions: transactions as BackupData['transactions'],
  } as BackupData;
}

describe('normalizeBackupToV5 (M1)', () => {
  it('bumps the backup version to 7 (splitSessions table — T16)', () => {
    expect(BACKUP_VERSION).toBe(7);
  });

  it('fills missing location fields with null on a v4 transaction', () => {
    const v4Tx = {
      id: 'tx-1',
      tripId: 'trip-1',
      phaseId: 'phase-1',
      amountCents: 1000,
      // no placeLabel / latitude / longitude / placeId (pre-v5 file)
    };
    const normalized = normalizeBackupToV5(makeBackup([v4Tx]));
    const tx = normalized.transactions[0]!;
    expect(tx.placeLabel).toBeNull();
    expect(tx.latitude).toBeNull();
    expect(tx.longitude).toBeNull();
    expect(tx.placeId).toBeNull();
  });

  it('preserves a transaction that already carries a location', () => {
    const located = {
      id: 'tx-2',
      tripId: 'trip-1',
      phaseId: 'phase-1',
      amountCents: 2000,
      placeLabel: 'Bar do Porto',
      latitude: 41.1579,
      longitude: -8.6291,
      placeId: 'osm:42',
    };
    const normalized = normalizeBackupToV5(makeBackup([located]));
    const tx = normalized.transactions[0]!;
    expect(tx.placeLabel).toBe('Bar do Porto');
    expect(tx.latitude).toBe(41.1579);
    expect(tx.longitude).toBe(-8.6291);
    expect(tx.placeId).toBe('osm:42');
  });
});
