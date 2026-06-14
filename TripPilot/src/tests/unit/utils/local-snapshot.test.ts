import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { createDefaultAppSettings } from '@/data/db/seed';
import { localSnapshotRepository } from '@/data/repositories';
import {
  recordDailyLocalSnapshot,
  restoreLocalSnapshot,
} from '@/utils/local-snapshot';
import { snapshotDayId } from '@/domain/local-snapshots';
import type { Trip } from '@/domain/types/trip';
import type { LocalSnapshot } from '@/domain/types/local-snapshot';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

const TRIP: Trip = {
  ...meta,
  id: 'trip-1',
  name: 'Snapshot Trip',
  baseCurrency: 'EUR',
  startDate: '2031-07-01',
  endDate: '2031-07-10',
  status: 'active',
  notes: null,
};

const TRIP2: Trip = { ...TRIP, id: 'trip-2', name: 'Second Trip' };

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seedActiveTrip(): Promise<void> {
  await db.trips.add(TRIP);
  await db.appSettings.add({ ...createDefaultAppSettings(), activeTrip: 'trip-1' });
}

function oldSnapshot(day: string): LocalSnapshot {
  return { id: day, createdAt: `${day}T08:00:00.000Z`, expenseCount: 0, json: '{}' };
}

describe('local snapshot history — daily restore points (E6 / M14-M15)', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('writes nothing when there is no active trip to protect', async () => {
    await recordDailyLocalSnapshot();
    expect(await localSnapshotRepository.getAll()).toHaveLength(0);
  });

  it('captures exactly one restore point per day', async () => {
    await seedActiveTrip();

    await recordDailyLocalSnapshot();
    await recordDailyLocalSnapshot();
    await recordDailyLocalSnapshot();

    const all = await localSnapshotRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(snapshotDayId());
    // The payload is a real backup containing the seeded trip.
    expect(all[0]?.json).toContain('trip-1');
  });

  it('prunes to the 7 newest, dropping the oldest day', async () => {
    await seedActiveTrip();
    // Seven older days already stored (2026-06-01 .. 2026-06-07).
    for (let i = 1; i <= 7; i++) {
      await localSnapshotRepository.put(oldSnapshot(`2026-06-0${i}`));
    }

    await recordDailyLocalSnapshot(); // adds today → 8 total → prune 1

    const all = await localSnapshotRepository.getAll();
    expect(all).toHaveLength(7);
    const ids = all.map((s) => s.id);
    expect(ids).toContain(snapshotDayId());
    expect(ids).not.toContain('2026-06-01'); // the oldest was pruned
    expect(ids).toContain('2026-06-07');
  });

  it('restores a stored point via the atomic replace import', async () => {
    await seedActiveTrip();
    await recordDailyLocalSnapshot();
    const [snapshot] = await localSnapshotRepository.getAll();
    expect(snapshot).toBeDefined();

    // Drift the DB after the snapshot was taken.
    await db.trips.add(TRIP2);
    expect(await db.trips.count()).toBe(2);

    const ok = await restoreLocalSnapshot(snapshot!);

    expect(ok).toBe(true);
    const trips = await db.trips.toArray();
    expect(trips.map((t) => t.id)).toEqual(['trip-1']); // replace dropped trip-2
  });

  it('refuses to restore an unreadable payload', async () => {
    await seedActiveTrip();
    const bad: LocalSnapshot = {
      id: '2026-06-13',
      createdAt: '2026-06-13T08:00:00.000Z',
      expenseCount: 0,
      json: 'not-json',
    };

    const ok = await restoreLocalSnapshot(bad);

    expect(ok).toBe(false);
    // The DB is untouched on a failed restore.
    expect(await db.trips.count()).toBe(1);
  });
});
