import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { TripPilotDB } from '@/data/db/database';
import { SCHEMA_V10 } from '@/data/db/schema';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

const v10Pool = (id: string, cents: number) => ({
  ...meta,
  id,
  tripId: 'trip-1',
  name: id,
  scope: 'global' as const,
  totalAmountCents: cents,
  currency: 'EUR',
  notes: null,
  dateStart: null,
  dateEnd: null,
  goalCents: null,
});

describe('Dexie v11 migration (T16 — bill split / splitSessions)', () => {
  it('adds the empty splitSessions table without touching existing data', async () => {
    const dbName = `MigrationV11-${Date.now()}`;
    const v10db = new Dexie(dbName);
    v10db.version(10).stores(SCHEMA_V10);
    await v10db.open();
    const before = [v10Pool('pool-a', 50000), v10Pool('pool-b', 30000)];
    await v10db.table('budgetPools').bulkAdd(before);
    const sumBefore = before.reduce((s, p) => s + p.totalAmountCents, 0);
    v10db.close();

    const db = new TripPilotDB(dbName);
    await db.open();
    try {
      // New table exists and is empty after an additive upgrade.
      expect(await db.splitSessions.count()).toBe(0);

      // Existing data is byte-preserved (the money invariant holds).
      const pools = await db.budgetPools.toArray();
      expect(pools).toHaveLength(2);
      expect(pools.reduce((s, p) => s + p.totalAmountCents, 0)).toBe(sumBefore);
    } finally {
      db.close();
      await Dexie.delete(dbName);
    }
  });

  it('persists and round-trips a SplitRecord (indexed projections queryable)', async () => {
    const dbName = `MigrationV11-rt-${Date.now()}`;
    const db = new TripPilotDB(dbName);
    await db.open();
    try {
      await db.splitSessions.add({
        ...meta,
        id: 'split-1',
        tripId: 'trip-1',
        sessionId: null,
        status: 'live',
        splitMeta: {
          id: 'split-1',
          tripId: 'trip-1',
          phaseId: null,
          name: 'Jantar',
          currency: 'BRL',
          status: 'live',
          mode: 'itemized',
          serviceCharge: { mode: 'none', source: 'manual', amountCents: 0, percent: null },
          adjustments: [],
          items: [],
          participants: [],
          readTotalCents: null,
          createdAt: meta.createdAt,
        },
      });

      const byStatus = await db.splitSessions.where('status').equals('live').toArray();
      expect(byStatus).toHaveLength(1);
      expect(byStatus[0]!.splitMeta.name).toBe('Jantar');

      const byTrip = await db.splitSessions.where('tripId').equals('trip-1').toArray();
      expect(byTrip).toHaveLength(1);
    } finally {
      db.close();
      await Dexie.delete(dbName);
    }
  });
});
