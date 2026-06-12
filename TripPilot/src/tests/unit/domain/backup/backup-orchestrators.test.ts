import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { buildFullBackup, importBackup } from '@/domain/orchestrators';
import { BACKUP_TABLE_KEYS } from '@/domain/backup';
import { createExpenseTransaction } from '@/domain/transactions';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { AppSettings } from '@/domain/types/app-settings';
import type { Trip } from '@/domain/types/trip';
import type { Settlement } from '@/domain/types/settlement';

const settings: AppSettings = {
  id: 'app-settings',
  activeTrip: null,
  alertTone: 'amigo_sincero',
  defaultCurrency: 'EUR',
  themePreference: 'dark',
  language: 'pt-BR',
  vibrationEnabled: true,
  backupReminderEnabled: true,
  backupReminderDays: 7,
  lastBackupDate: null,
  deviceName: 'Test device',
  persistentStorageGranted: false,
  isDemo: false,
  onboardingCompleted: true,
  quickAddDefaultValuesCents: [300, 500, 700, 1000, 1500],
  hiddenDashboardCards: [],
  dashboardCardOrder: [],
  outingNotificationEnabled: true,
  anchorCurrency: null,
  anchorRatePer1: null,
};

const mkTrip = (): Trip => ({
  ...createSyncMetadata(),
  name: 'Euro trip',
  baseCurrency: 'EUR',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  status: 'active',
  notes: null,
});

const mkSettlement = (tripId: string): Settlement => ({
  ...createSyncMetadata(),
  tripId,
  debtorParticipantId: 'p2',
  creditorParticipantId: 'p1',
  amountCents: 1500,
  currency: 'EUR',
  settledAt: '2026-07-10T12:00:00.000Z',
  linkedTransactionId: null,
  notes: null,
});

async function clearAllTables() {
  await Promise.all(BACKUP_TABLE_KEYS.map((key) => db[key].clear()));
  await db.appSettings.clear();
}

describe('backup round-trip (export → import into clean DB)', () => {
  beforeEach(clearAllTables);

  it('restores identical record counts per table, including new tables', async () => {
    const trip = mkTrip();
    await db.trips.add(trip);
    await db.transactions.add(
      createExpenseTransaction({
        tripId: trip.id,
        phaseId: createSyncMetadata().id,
        budgetPoolId: 'pool-1',
        walletId: null,
        amountCents: 4200,
        currency: 'EUR',
        category: 'bar',
        description: 'Drinks',
      }),
    );
    await db.settlements.add(mkSettlement(trip.id));

    const backup = await buildFullBackup(settings);
    expect(backup.trips).toHaveLength(1);
    expect(backup.transactions).toHaveLength(1);
    expect(backup.settlements).toHaveLength(1);

    const counts = Object.fromEntries(
      await Promise.all(
        BACKUP_TABLE_KEYS.map(async (key) => [key, await db[key].count()] as const),
      ),
    );

    await clearAllTables();
    await importBackup(backup, 'replace');

    for (const key of BACKUP_TABLE_KEYS) {
      expect(await db[key].count(), `table ${key}`).toBe(counts[key]);
    }
  });

  it('exports soft-deleted records so deletions propagate', async () => {
    const trip = mkTrip();
    await db.trips.add({ ...trip, deletedAt: '2026-07-05T00:00:00.000Z', revision: 2 });
    const backup = await buildFullBackup(settings);
    expect(backup.trips).toHaveLength(1);
    expect(backup.trips[0]!.deletedAt).not.toBeNull();
  });
});

describe('importBackup merge by revision (GAP-004)', () => {
  beforeEach(clearAllTables);

  it('newer incoming revision overwrites the local record', async () => {
    const trip = mkTrip();
    await db.trips.add(trip);

    const backup = await buildFullBackup(settings);
    backup.trips = [{ ...trip, name: 'Renamed on other device', revision: trip.revision + 1 }];

    await importBackup(backup, 'merge');
    const stored = await db.trips.get(trip.id);
    expect(stored!.name).toBe('Renamed on other device');
    expect(stored!.revision).toBe(trip.revision + 1);
  });

  it('older incoming revision is NOT applied (local wins)', async () => {
    const trip = { ...mkTrip(), revision: 3, name: 'Local newest' };
    await db.trips.add(trip);

    const backup = await buildFullBackup(settings);
    backup.trips = [{ ...trip, name: 'Stale import', revision: 1 }];

    await importBackup(backup, 'merge');
    const stored = await db.trips.get(trip.id);
    expect(stored!.name).toBe('Local newest');
    expect(stored!.revision).toBe(3);
  });

  it('merge keeps local records missing from the incoming file', async () => {
    const tripA = mkTrip();
    const tripB = { ...mkTrip(), name: 'Second trip' };
    await db.trips.bulkAdd([tripA, tripB]);

    const backup = await buildFullBackup(settings);
    backup.trips = [tripA];

    await importBackup(backup, 'merge');
    expect(await db.trips.count()).toBe(2);
  });
});
