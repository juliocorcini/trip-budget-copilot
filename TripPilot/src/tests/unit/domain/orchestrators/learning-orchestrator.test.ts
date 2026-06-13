import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { applyValueSuggestion, dismissValueSuggestion } from '@/domain/orchestrators';
import { detectValueSuggestion } from '@/domain/profiles';
import { createExpenseTransaction } from '@/domain/transactions';
import { createDefaultAppSettings, APP_SETTINGS_ID } from '@/data/db/seed';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Session } from '@/domain/types/session';

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seedSettings(): Promise<void> {
  await db.appSettings.put({ ...createDefaultAppSettings(), id: APP_SETTINGS_ID });
}

const mkProfile = (overrides: Partial<ActivityProfile> = {}): ActivityProfile => ({
  ...createSyncMetadata(),
  tripId: 'trip-1',
  name: 'Bar',
  category: 'bar',
  iconName: null,
  color: null,
  typicalValueCents: 1500,
  safeValueCents: 2000,
  confidence: 'low',
  dataPointCount: 0,
  expectedFrequencyPerPhase: null,
  isCustom: false,
  defaultTargetCents: null,
  defaultCeilingCents: null,
  defaultMaxCents: null,
  defaultAvgDrinkPriceCents: null,
  quickAddValuesCents: null,
  notes: null,
  ...overrides,
});

const mkSession = (id: string, endedAt: string): Session => ({
  ...createSyncMetadata(),
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  activityProfileId: 'bar',
  status: 'completed',
  name: 'Bar night',
  targetCents: null,
  ceilingCents: null,
  maxCents: null,
  startedAt: '2026-01-01T00:00:00.000Z',
  endedAt,
  quickAddValuesCents: [],
  avgDrinkPriceCents: null,
  firedAlertPercents: [],
  overMaxConfirmedAt: null,
  notes: null,
});

const mkTx = (sessionId: string, amountCents: number) =>
  createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'item',
    sessionId,
    activityProfileId: 'bar',
  });

describe('applyValueSuggestion (M19 — accept writes the profile)', () => {
  beforeEach(async () => {
    await clearAll();
    await seedSettings();
  });

  it('updates the typical and safe values on accept', async () => {
    await db.activityProfiles.add(mkProfile({ id: 'bar' }));

    await applyValueSuggestion({ profileId: 'bar', typicalValueCents: 2200, safeValueCents: 2860 });

    const stored = await db.activityProfiles.get('bar');
    expect(stored!.typicalValueCents).toBe(2200);
    expect(stored!.safeValueCents).toBe(2860);
  });

  it('is a no-op when the profile is missing or deleted', async () => {
    await db.activityProfiles.add(
      mkProfile({ id: 'bar', deletedAt: '2026-01-09T00:00:00.000Z' }),
    );
    await applyValueSuggestion({ profileId: 'bar', typicalValueCents: 9999, safeValueCents: 9999 });
    const stored = await db.activityProfiles.get('bar');
    expect(stored!.typicalValueCents).toBe(1500);
  });
});

describe('dismissValueSuggestion (M19 — keep records, never changes the profile)', () => {
  beforeEach(async () => {
    await clearAll();
    await seedSettings();
  });

  it('records the dismissal idempotently and leaves the profile untouched', async () => {
    await db.activityProfiles.add(mkProfile({ id: 'bar' }));

    await dismissValueSuggestion('bar');
    await dismissValueSuggestion('bar');

    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    expect(settings!.valueSuggestionsDismissed).toEqual(['bar']);
    const stored = await db.activityProfiles.get('bar');
    expect(stored!.typicalValueCents).toBe(1500);
  });
});

// ÂNCORA 12 / DEC-007: the app proposes — nothing changes until the user accepts.
describe('learning never changes a profile silently', () => {
  beforeEach(async () => {
    await clearAll();
    await seedSettings();
  });

  it('detects a suggestion without mutating, and dismiss suppresses it', async () => {
    const profile = mkProfile({ id: 'bar', typicalValueCents: 1500 });
    await db.activityProfiles.add(profile);
    const sessions = [1, 2, 3].map((n) => mkSession(`s${n}`, `2026-01-0${n}T22:00:00.000Z`));
    const txs = sessions.map((s) => mkTx(s.id, 2200));

    const before = await db.activityProfiles.get('bar');
    const suggestion = detectValueSuggestion({
      profiles: [profile],
      sessions,
      transactions: txs,
      dismissedProfileIds: [],
    });

    // A suggestion exists, but merely detecting it changed NOTHING in the DB.
    expect(suggestion).not.toBeNull();
    expect((await db.activityProfiles.get('bar'))!.typicalValueCents).toBe(
      before!.typicalValueCents,
    );

    // After the user keeps it, the same divergence no longer surfaces.
    await dismissValueSuggestion('bar');
    const dismissed = (await db.appSettings.get(APP_SETTINGS_ID))!.valueSuggestionsDismissed;
    expect(
      detectValueSuggestion({
        profiles: [profile],
        sessions,
        transactions: txs,
        dismissedProfileIds: dismissed,
      }),
    ).toBeNull();
  });
});
