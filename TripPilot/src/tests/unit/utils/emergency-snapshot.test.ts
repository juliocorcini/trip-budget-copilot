import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { createDefaultAppSettings } from '@/data/db/seed';
import {
  writeEmergencySnapshot,
  recordExpenseForSnapshot,
  hasEmergencySnapshot,
  readEmergencySnapshot,
  readEmergencySnapshotMeta,
  clearEmergencySnapshot,
} from '@/utils/emergency-snapshot';
import type { Trip } from '@/domain/types/trip';

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

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seedActiveTrip(): Promise<void> {
  await db.trips.add(TRIP);
  await db.appSettings.add({ ...createDefaultAppSettings(), activeTrip: 'trip-1' });
}

describe('emergency snapshot — iOS eviction safety net (BUG-002)', () => {
  beforeEach(async () => {
    await clearAll();
    clearEmergencySnapshot();
  });

  it('writes nothing when there is no active trip to protect', async () => {
    const ok = await writeEmergencySnapshot();
    expect(ok).toBe(false);
    expect(hasEmergencySnapshot()).toBe(false);
  });

  it('stores a full snapshot once an active trip exists', async () => {
    await seedActiveTrip();

    const ok = await writeEmergencySnapshot();

    expect(ok).toBe(true);
    expect(hasEmergencySnapshot()).toBe(true);
    const snapshot = readEmergencySnapshot();
    expect(snapshot?.trips).toHaveLength(1);
    expect(snapshot?.trips[0]?.id).toBe('trip-1');
    expect(readEmergencySnapshotMeta()?.tripCount).toBe(1);
  });

  it('writes a snapshot only once every interval of expenses', async () => {
    await seedActiveTrip();

    for (let i = 0; i < 4; i++) {
      await recordExpenseForSnapshot();
    }
    // Below the threshold — no snapshot yet.
    expect(hasEmergencySnapshot()).toBe(false);

    await recordExpenseForSnapshot();
    // The fifth expense crosses the interval and triggers the write.
    expect(hasEmergencySnapshot()).toBe(true);
  });

  it('clears the stored snapshot on demand', async () => {
    await seedActiveTrip();
    await writeEmergencySnapshot();
    expect(hasEmergencySnapshot()).toBe(true);

    clearEmergencySnapshot();

    expect(hasEmergencySnapshot()).toBe(false);
    expect(readEmergencySnapshot()).toBeNull();
  });
});
