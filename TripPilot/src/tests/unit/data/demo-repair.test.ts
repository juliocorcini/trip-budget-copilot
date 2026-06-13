import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { repairDemoTripIfNeeded } from '@/data/demo-repair';
import { activityProfileRepository } from '@/data/repositories';
import { createDefaultAppSettings } from '@/data/db/seed';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

// A trip entirely in the future — no phase is active "today".
const FUTURE_TRIP: Trip = {
  ...meta,
  id: 'trip-real',
  name: 'Eurotrip 2031',
  baseCurrency: 'EUR',
  startDate: '2031-07-01',
  endDate: '2031-07-30',
  status: 'active',
  notes: null,
};

const FUTURE_PHASE: Phase = {
  ...meta,
  id: 'phase-real',
  tripId: 'trip-real',
  name: 'Lisboa',
  startDate: '2031-07-01',
  endDate: '2031-07-30',
  order: 0,
  rhythmPreset: null,
  peakDays: null,
  notes: null,
};

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

function settingsFor(tripId: string, isDemo: boolean) {
  return { ...createDefaultAppSettings(), activeTrip: tripId, isDemo };
}

describe('repairDemoTripIfNeeded (DEC-111 / R5-03)', () => {
  beforeEach(clearAll);

  it('NEVER rewrites the dates of a real trip outside its date range', async () => {
    await db.trips.add(FUTURE_TRIP);
    await db.phases.add(FUTURE_PHASE);

    await repairDemoTripIfNeeded(settingsFor('trip-real', false));

    const trip = await db.trips.get('trip-real');
    const phase = await db.phases.get('phase-real');
    expect(trip!.startDate).toBe('2031-07-01');
    expect(trip!.endDate).toBe('2031-07-30');
    expect(phase!.startDate).toBe('2031-07-01');
    expect(phase!.endDate).toBe('2031-07-30');
  });

  it('still rewrites stale dates for the DEMO trip', async () => {
    await db.trips.add({ ...FUTURE_TRIP, id: 'trip-demo', name: 'Demo' });
    await db.phases.add({ ...FUTURE_PHASE, id: 'phase-demo', tripId: 'trip-demo' });

    await repairDemoTripIfNeeded(settingsFor('trip-demo', true));

    const trip = await db.trips.get('trip-demo');
    // Demo repair re-anchors the trip around "today".
    expect(trip!.startDate).not.toBe('2031-07-01');
  });
});

describe('repairDemoTripIfNeeded — profile recreation scope (BUG-015)', () => {
  beforeEach(clearAll);

  it('does NOT recreate profiles for a REAL trip with zero active profiles', async () => {
    await db.trips.add(FUTURE_TRIP);
    await db.phases.add(FUTURE_PHASE);

    await repairDemoTripIfNeeded(settingsFor('trip-real', false));

    const profiles = await activityProfileRepository.getByTripId('trip-real');
    expect(profiles).toHaveLength(0);
  });

  it('recreates the default profiles for the DEMO trip when it has none', async () => {
    await db.trips.add({ ...FUTURE_TRIP, id: 'trip-demo', name: 'Demo' });
    await db.phases.add({ ...FUTURE_PHASE, id: 'phase-demo', tripId: 'trip-demo' });

    await repairDemoTripIfNeeded(settingsFor('trip-demo', true));

    const profiles = await activityProfileRepository.getByTripId('trip-demo');
    expect(profiles).toHaveLength(3);
  });

  it('never resurrects profiles a real-trip user deleted (no boot-time duplicates)', async () => {
    await db.trips.add(FUTURE_TRIP);
    await db.phases.add(FUTURE_PHASE);

    // Two consecutive boots on a real trip must keep it at zero profiles.
    await repairDemoTripIfNeeded(settingsFor('trip-real', false));
    await repairDemoTripIfNeeded(settingsFor('trip-real', false));

    const profiles = await activityProfileRepository.getByTripId('trip-real');
    expect(profiles).toHaveLength(0);
  });
});
