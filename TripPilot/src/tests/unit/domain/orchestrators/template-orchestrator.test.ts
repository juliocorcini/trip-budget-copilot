import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  saveTripTemplate,
  deleteTripTemplate,
  markTripPriorsHandled,
  createTripFromTemplate,
} from '@/domain/orchestrators';
import { instantiateTemplate } from '@/domain/templates';
import { createOnboardingEntities } from '@/domain/onboarding';
import { createDefaultAppSettings, APP_SETTINGS_ID } from '@/data/db/seed';
import type { TripTemplate } from '@/domain/types/trip-template';

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seedSettings(): Promise<void> {
  await db.appSettings.put({ ...createDefaultAppSettings(), id: APP_SETTINGS_ID });
}

const TEMPLATE: TripTemplate = {
  id: 'tpl-1',
  name: 'Lisboa',
  createdAt: '2026-06-11T00:00:00.000Z',
  baseCurrency: 'EUR',
  phases: [
    { name: 'City', order: 0, durationDays: 5, rhythmPreset: 'moderate', peakDays: [5, 6] },
    { name: 'Coast', order: 1, durationDays: 5, rhythmPreset: 'relaxed', peakDays: null },
  ],
  profiles: [
    {
      name: 'Bar',
      category: 'bar',
      iconName: 'local_bar',
      color: '#C75B39',
      typicalValueCents: 2200,
      safeValueCents: 3000,
      expectedFrequencyPerPhase: 5,
      isCustom: false,
      defaultTargetCents: 2000,
      defaultCeilingCents: 2800,
      defaultMaxCents: 3600,
      defaultAvgDrinkPriceCents: 350,
      quickAddValuesCents: [300, 500],
    },
  ],
};

describe('saveTripTemplate / deleteTripTemplate (M22)', () => {
  beforeEach(async () => {
    await clearAll();
    await seedSettings();
  });

  it('appends a template and replaces it by id (newest first)', async () => {
    await saveTripTemplate(TEMPLATE);
    await saveTripTemplate({ ...TEMPLATE, id: 'tpl-2', name: 'Roma' });
    let stored = (await db.appSettings.get(APP_SETTINGS_ID))!.tripTemplates;
    expect(stored.map((t) => t.id)).toEqual(['tpl-2', 'tpl-1']);

    await saveTripTemplate({ ...TEMPLATE, name: 'Lisboa 2' });
    stored = (await db.appSettings.get(APP_SETTINGS_ID))!.tripTemplates;
    expect(stored).toHaveLength(2);
    expect(stored.find((t) => t.id === 'tpl-1')!.name).toBe('Lisboa 2');
  });

  it('removes a template by id', async () => {
    await saveTripTemplate(TEMPLATE);
    await deleteTripTemplate('tpl-1');
    const stored = (await db.appSettings.get(APP_SETTINGS_ID))!.tripTemplates;
    expect(stored).toHaveLength(0);
  });
});

describe('markTripPriorsHandled (M21)', () => {
  beforeEach(async () => {
    await clearAll();
    await seedSettings();
  });

  it('records the trip id idempotently', async () => {
    await markTripPriorsHandled('trip-1');
    await markTripPriorsHandled('trip-1');
    const stored = (await db.appSettings.get(APP_SETTINGS_ID))!.tripPriorsHandled;
    expect(stored).toEqual(['trip-1']);
  });
});

describe('createTripFromTemplate (M23 — applying recreates the structure, atomically)', () => {
  beforeEach(async () => {
    await clearAll();
    await seedSettings();
  });

  it('persists the trip with the template phases, links and learned profiles', async () => {
    const entities = createOnboardingEntities({
      tripName: 'Lisboa II',
      phaseName: 'Lisboa II',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      currency: 'EUR',
      totalAmountCents: 200000,
      protectedReserveCents: 0,
      ownerName: 'Julio',
      ownerEmail: null,
      deviceId: 'dev-1',
      defaultWalletName: 'Card',
      cashWalletName: null,
      phaseStartDate: null,
      phaseEndDate: null,
      rhythmPreset: null,
      peakDays: null,
      poolName: 'Pool',
      reserveName: 'Reserve',
    });

    const { phases, links, profiles } = instantiateTemplate({
      template: TEMPLATE,
      tripId: entities.trip.id,
      budgetPoolId: entities.pool.id,
      startDate: entities.trip.startDate,
      endDate: entities.trip.endDate,
      deviceId: entities.trip.sourceDeviceId,
      now: '2026-08-20T00:00:00.000Z',
    });

    await createTripFromTemplate({
      trip: entities.trip,
      pool: entities.pool,
      reserve: entities.reserve,
      owner: entities.owner,
      wallets: entities.wallets,
      phases,
      links,
      profiles,
    });

    const tripId = entities.trip.id;
    const storedTrip = await db.trips.get(tripId);
    const storedPhases = (await db.phases.toArray()).filter((p) => p.tripId === tripId);
    const storedLinks = (await db.budgetPoolPhaseLinks.toArray()).filter(
      (l) => l.budgetPoolId === entities.pool.id,
    );
    const storedProfiles = (await db.activityProfiles.toArray()).filter((p) => p.tripId === tripId);
    const storedPool = await db.budgetPools.get(entities.pool.id);
    const storedOwner = (await db.participants.toArray()).filter((p) => p.tripId === tripId);

    expect(storedTrip).toBeDefined();
    expect(storedPhases).toHaveLength(2);
    expect(storedPhases.map((p) => p.name).sort()).toEqual(['City', 'Coast']);
    expect(storedLinks).toHaveLength(2);
    expect(storedProfiles).toHaveLength(1);
    expect(storedProfiles[0]!.typicalValueCents).toBe(2200);
    // M23: the new trip re-learns — applied profiles start cold.
    expect(storedProfiles[0]!.confidence).toBe('low');
    expect(storedProfiles[0]!.dataPointCount).toBe(0);
    expect(storedPool).toBeDefined();
    expect(storedOwner).toHaveLength(1);
  });
});
