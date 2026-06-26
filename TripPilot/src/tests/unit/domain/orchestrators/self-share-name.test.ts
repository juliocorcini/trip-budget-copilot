import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { resolveSelfShareName } from '@/domain/orchestrators';
import { participantRepository } from '@/data/repositories';
import { createParticipant } from '@/domain/splitting';
import { createDefaultAppSettings, APP_SETTINGS_ID } from '@/data/db/seed';
import type { AppSettings } from '@/domain/types/app-settings';

/**
 * DEC-350 (G4) — the impure resolver reads the ACTIVE trip's owner participant
 * name (the onboarding name) and resolves it ahead of profileName/deviceName, so
 * every share/connect/P2P stamp announces my real name instead of "Android ·
 * Chrome". Tested against the real (fake-indexeddb) db.
 */
const TRIP = 'trip-self-name';

async function seedSettings(over: Partial<AppSettings>): Promise<void> {
  await db.appSettings.put({ ...createDefaultAppSettings(), id: APP_SETTINGS_ID, ...over });
}

describe('resolveSelfShareName (DEC-350)', () => {
  beforeEach(async () => {
    await db.appSettings.clear();
    await db.participants.clear();
  });

  it('returns the active trip owner name over profileName and deviceName', async () => {
    await seedSettings({ activeTrip: TRIP, profileName: 'JJ', deviceName: 'Android · Chrome' });
    await participantRepository.create({
      ...createParticipant(TRIP, 'Júlio', null),
      isOwner: true,
    });

    expect(await resolveSelfShareName()).toBe('Júlio');
  });

  it('falls back to profileName when there is no owner participant (no trip yet)', async () => {
    await seedSettings({ activeTrip: null, profileName: 'JJ', deviceName: 'Android · Chrome' });
    expect(await resolveSelfShareName()).toBe('JJ');
  });

  it('falls back to the device label when no real name exists', async () => {
    await seedSettings({ activeTrip: null, profileName: null, deviceName: 'Android · Chrome' });
    expect(await resolveSelfShareName()).toBe('Android · Chrome');
  });

  it('ignores a soft-deleted owner and uses the next fallback', async () => {
    await seedSettings({ activeTrip: TRIP, profileName: 'JJ', deviceName: 'Android · Chrome' });
    await participantRepository.create({
      ...createParticipant(TRIP, 'Old Owner', null),
      isOwner: true,
      deletedAt: new Date().toISOString(),
    });

    expect(await resolveSelfShareName()).toBe('JJ');
  });

  it('accepts pre-loaded settings without a second read', async () => {
    await participantRepository.create({
      ...createParticipant(TRIP, 'Maria', null),
      isOwner: true,
    });
    const settings: AppSettings = {
      ...createDefaultAppSettings(),
      id: APP_SETTINGS_ID,
      activeTrip: TRIP,
      deviceName: 'iPhone · Safari',
    };
    expect(await resolveSelfShareName(settings)).toBe('Maria');
  });
});
