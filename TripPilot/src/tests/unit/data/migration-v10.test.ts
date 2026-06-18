import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { TripPilotDB } from '@/data/db/database';
import { SCHEMA_V9 } from '@/data/db/schema';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

// A v9 budgetPool record predates the GATE 3 pot fields — it has no
// dateStart/dateEnd/goalCents at all.
const v9Pool = (id: string, scope: 'global' | 'linked_phases', cents: number) => ({
  ...meta,
  id,
  tripId: 'trip-1',
  name: id,
  scope,
  totalAmountCents: cents,
  currency: 'EUR',
  notes: null,
});

describe('Dexie v10 migration (GATE 3 — Unified Pots, D7)', () => {
  it('backfills dateStart/dateEnd/goalCents to null and preserves the money invariant', async () => {
    const dbName = `MigrationV10-${Date.now()}`;
    const v9db = new Dexie(dbName);
    v9db.version(9).stores(SCHEMA_V9);
    await v9db.open();
    const before = [
      v9Pool('pool-burgos', 'linked_phases', 62800),
      v9Pool('pool-eurotrip', 'linked_phases', 67800),
      v9Pool('pool-shopping', 'global', 30000),
    ];
    await v9db.table('budgetPools').bulkAdd(before);
    const sumBefore = before.reduce((s, p) => s + p.totalAmountCents, 0);
    v9db.close();

    const db = new TripPilotDB(dbName);
    await db.open();
    try {
      const pools = await db.budgetPools.toArray();
      expect(pools).toHaveLength(3);
      const sumAfter = pools.reduce((s, p) => s + p.totalAmountCents, 0);
      // Invariant: the upgrade never moves a cent.
      expect(sumAfter).toBe(sumBefore);

      for (const pool of pools) {
        expect(pool.dateStart).toBeNull();
        expect(pool.dateEnd).toBeNull();
        expect(pool.goalCents).toBeNull();
      }
      // Per-pool totals are byte-identical too (not just the sum).
      expect(pools.find((p) => p.id === 'pool-burgos')!.totalAmountCents).toBe(62800);
      expect(pools.find((p) => p.id === 'pool-shopping')!.totalAmountCents).toBe(30000);
    } finally {
      db.close();
      await Dexie.delete(dbName);
    }
  });
});
