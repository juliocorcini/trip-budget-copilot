import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { TripPilotDB } from '@/data/db/database';
import { SCHEMA_V2 } from '@/data/db/schema';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

/** Seeds a v2 database, then reopens it with the production class (v3). */
async function migrateV2ToV3(dbName: string): Promise<TripPilotDB> {
  const v2db = new Dexie(dbName);
  v2db.version(2).stores(SCHEMA_V2);
  await v2db.open();

  await v2db.table('participantShares').add({
    ...meta,
    id: 'share-1',
    transactionId: 'tx-1',
    participantId: 'p-1',
    shareAmountCents: 2000,
    shareType: 'equal',
    isPaid: false,
    notes: null,
  });
  await v2db.table('phases').add({
    ...meta,
    id: 'phase-1',
    tripId: 'trip-1',
    name: 'Burgos',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
    order: 0,
    notes: null,
  });
  await v2db.table('plannedOccurrences').add({
    ...meta,
    id: 'occ-1',
    tripId: 'trip-1',
    phaseId: 'phase-1',
    activityProfileId: 'prof-1',
    budgetPoolId: 'pool-1',
    name: 'Festa',
    plannedDate: '2026-06-12',
    estimatedCostCents: 5000,
    isConfirmed: false,
    linkedTransactionId: null,
    notes: null,
  });
  v2db.close();

  const v3db = new TripPilotDB(dbName);
  await v3db.open();
  return v3db;
}

describe('Dexie v3 unified migration (DEC-071/072/074/075)', () => {
  it('preserves v2 data and populates permissive defaults', async () => {
    const db = await migrateV2ToV3(`MigrationTest-${Date.now()}`);
    try {
      const share = await db.participantShares.get('share-1');
      expect(share).toBeDefined();
      expect(share!.shareAmountCents).toBe(2000);
      // DEC-071: existing shares are treated as confirmed (no behavior change).
      expect(share!.confirmationStatus).toBe('confirmed');

      const phase = await db.phases.get('phase-1');
      expect(phase).toBeDefined();
      expect(phase!.name).toBe('Burgos');
      expect(phase!.rhythmPreset).toBeNull();
      expect(phase!.peakDays).toBeNull();

      const occ = await db.plannedOccurrences.get('occ-1');
      expect(occ).toBeDefined();
      expect(occ!.estimatedCostCents).toBe(5000);
      expect(occ!.endDate).toBeNull();
      expect(occ!.kind).toBe('event');
      expect(occ!.reservedCents).toBeNull();
      expect(occ!.linkedSessionId).toBeNull();
    } finally {
      db.close();
      await Dexie.delete(db.name);
    }
  });

  it('creates the phaseProfileSettings table with the compound index', async () => {
    const db = await migrateV2ToV3(`MigrationTest2-${Date.now()}`);
    try {
      await db.phaseProfileSettings.add({
        ...meta,
        id: 'pps-1',
        phaseId: 'phase-1',
        activityProfileId: 'prof-1',
        isEnabled: false,
      });
      const found = await db.phaseProfileSettings
        .where('[phaseId+activityProfileId]')
        .equals(['phase-1', 'prof-1'])
        .first();
      expect(found).toBeDefined();
      expect(found!.isEnabled).toBe(false);
    } finally {
      db.close();
      await Dexie.delete(db.name);
    }
  });
});
