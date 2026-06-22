import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { appSettingsRepository } from '@/data/repositories';
import { APP_SETTINGS_ID, createDefaultAppSettings } from '@/data/db/seed';
import type { Trip } from '@/domain/types/trip';
import type { AppSettings } from '@/domain/types/app-settings';

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
  name: 'Real Trip',
  baseCurrency: 'EUR',
  startDate: '2031-07-01',
  endDate: '2031-07-10',
  status: 'active',
  notes: null,
};

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

describe('appSettingsRepository — non-destructive get/update (BUG-003)', () => {
  beforeEach(clearAll);

  it('get() returns a transient default WITHOUT persisting a row when the settings row is missing', async () => {
    await db.trips.add(TRIP);

    const settings = await appSettingsRepository.get();

    // Transient default — activeTrip is null in memory…
    expect(settings.activeTrip).toBeNull();
    // …but nothing was written to disk (no destructive null row).
    const persisted = await db.appSettings.get(APP_SETTINGS_ID);
    expect(persisted).toBeUndefined();
  });

  it('update({ activeTrip: null }) recovers the existing trip instead of orphaning it', async () => {
    await db.trips.add(TRIP);

    const result = await appSettingsRepository.update({ activeTrip: null });

    expect(result.activeTrip).toBe('trip-1');
    const persisted = await db.appSettings.get(APP_SETTINGS_ID);
    expect(persisted?.activeTrip).toBe('trip-1');
  });

  it('a settings change never silently writes activeTrip:null while trips exist on disk', async () => {
    await db.trips.add(TRIP);

    // The settings row is missing → current.activeTrip is null. Changing the
    // theme must not persist that null and orphan the surviving trip.
    const result = await appSettingsRepository.update({ themePreference: 'light' });

    expect(result.activeTrip).toBe('trip-1');
    expect(result.themePreference).toBe('light');
  });

  it('persists activeTrip:null only when the DB is genuinely empty', async () => {
    const result = await appSettingsRepository.update({ activeTrip: null });

    expect(result.activeTrip).toBeNull();
    const persisted = await db.appSettings.get(APP_SETTINGS_ID);
    expect(persisted?.activeTrip).toBeNull();
  });

  it('prefers the active-status trip when recovering a null activeTrip', async () => {
    await db.trips.add({ ...TRIP, id: 'trip-completed', status: 'completed' });
    await db.trips.add({ ...TRIP, id: 'trip-active', status: 'active' });

    const result = await appSettingsRepository.update({ activeTrip: null });

    expect(result.activeTrip).toBe('trip-active');
  });
});

describe('appSettingsRepository — appMode (M15)', () => {
  beforeEach(clearAll);

  it('defaults appMode to complete on an empty DB (transient default)', async () => {
    const settings = await appSettingsRepository.get();
    expect(settings.appMode).toBe('complete');
  });

  it('backfills appMode to complete for records predating the field', async () => {
    // A settings row written before appMode existed (no field on disk).
    const legacy = createDefaultAppSettings() as Partial<AppSettings>;
    delete legacy.appMode;
    await db.appSettings.put(legacy as AppSettings);

    const settings = await appSettingsRepository.get();
    expect(settings.appMode).toBe('complete');
  });

  it('persists a chosen appMode', async () => {
    await appSettingsRepository.update({ appMode: 'simple' });

    const settings = await appSettingsRepository.get();
    expect(settings.appMode).toBe('simple');
  });
});

describe('appSettingsRepository — location default ON (FB-03 / DEC-265)', () => {
  beforeEach(clearAll);

  it('a NEW install ships with location ON and the first-run notice unseen', () => {
    const fresh = createDefaultAppSettings();
    expect(fresh.locationCaptureEnabled).toBe(true);
    expect(fresh.locationDefaultNoticeAcknowledged).toBe(false);
  });

  it('AC4: a stored OFF choice is NEVER flipped ON on read (prior choice wins)', async () => {
    await db.appSettings.put({ ...createDefaultAppSettings(), locationCaptureEnabled: false });

    const settings = await appSettingsRepository.get();
    expect(settings.locationCaptureEnabled).toBe(false);
  });

  it('AC4: a record predating the field backfills OFF — a restore never forces ON', async () => {
    const legacy = createDefaultAppSettings() as Partial<AppSettings>;
    delete legacy.locationCaptureEnabled;
    await db.appSettings.put(legacy as AppSettings);

    const settings = await appSettingsRepository.get();
    expect(settings.locationCaptureEnabled).toBe(false);
  });

  it('existing installs (no notice field) read back as already-acknowledged', async () => {
    const legacy = createDefaultAppSettings() as Partial<AppSettings>;
    delete legacy.locationDefaultNoticeAcknowledged;
    await db.appSettings.put(legacy as AppSettings);

    const settings = await appSettingsRepository.get();
    expect(settings.locationDefaultNoticeAcknowledged).toBe(true);
  });

  it('persists the acknowledgement so the notice never shows again', async () => {
    await appSettingsRepository.update({ locationDefaultNoticeAcknowledged: true });

    const settings = await appSettingsRepository.get();
    expect(settings.locationDefaultNoticeAcknowledged).toBe(true);
  });
});
