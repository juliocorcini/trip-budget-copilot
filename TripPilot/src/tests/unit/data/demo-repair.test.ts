import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { repairDemoTripIfNeeded } from '@/data/demo-repair';
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

  it('recreates missing activity profiles for ANY trip (demo or real)', async () => {
    await db.trips.add(FUTURE_TRIP);
    await db.phases.add(FUTURE_PHASE);

    await repairDemoTripIfNeeded(settingsFor('trip-real', false));

    const profiles = await db.activityProfiles.where('tripId').equals('trip-real').toArray();
    expect(profiles.length).toBeGreaterThan(0);
  });
});
