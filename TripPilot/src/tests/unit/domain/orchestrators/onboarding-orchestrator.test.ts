import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { createTripFromOnboarding } from '@/domain/orchestrators';
import { createOnboardingEntities } from '@/domain/onboarding';
import { createDefaultActivityProfiles } from '@/domain/profiles';

function buildInput() {
  const entities = createOnboardingEntities({
    tripName: 'Italy',
    phaseName: 'Rome',
    startDate: '2031-07-01',
    endDate: '2031-07-10',
    currency: 'EUR',
    totalAmountCents: 200000,
    protectedReserveCents: 50000,
    ownerName: 'Owner',
    ownerEmail: null,
    deviceId: 'dev-1',
    defaultWalletName: 'Card',
    cashWalletName: 'Cash',
    phaseStartDate: null,
    phaseEndDate: null,
    rhythmPreset: null,
    peakDays: null,
    poolName: 'Rome budget',
    reserveName: 'Reserve',
  });
  return { ...entities, profiles: createDefaultActivityProfiles(entities.trip.id) };
}

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

describe('createTripFromOnboarding — atomic onboarding (BUG-013)', () => {
  beforeEach(clearAll);

  it('persists every entity when the transaction succeeds', async () => {
    const input = buildInput();

    await createTripFromOnboarding(input);

    expect(await db.trips.count()).toBe(1);
    expect(await db.phases.count()).toBe(1);
    expect(await db.budgetPools.count()).toBe(1);
    expect(await db.budgetPoolPhaseLinks.count()).toBe(1);
    expect(await db.envelopes.count()).toBe(1);
    expect(await db.participants.count()).toBe(1);
    expect(await db.wallets.count()).toBe(input.wallets.length);
    expect(await db.activityProfiles.count()).toBe(input.profiles.length);
  });

  it('rolls back ALL writes when one insert fails — no partial trip', async () => {
    const input = buildInput();
    // Pre-seed the owner id so the participant insert (after trip/phase/pool)
    // collides and aborts the whole transaction.
    await db.participants.add({ ...input.owner });

    await expect(createTripFromOnboarding(input)).rejects.toBeDefined();

    // Everything written before the failing insert was rolled back.
    expect(await db.trips.count()).toBe(0);
    expect(await db.phases.count()).toBe(0);
    expect(await db.budgetPools.count()).toBe(0);
    expect(await db.budgetPoolPhaseLinks.count()).toBe(0);
    expect(await db.envelopes.count()).toBe(0);
    expect(await db.wallets.count()).toBe(0);
    expect(await db.activityProfiles.count()).toBe(0);
    // Only the pre-seeded participant survives.
    expect(await db.participants.count()).toBe(1);
  });

  it('a retry after a failure creates everything cleanly', async () => {
    const input = buildInput();
    await db.participants.add({ ...input.owner });
    await expect(createTripFromOnboarding(input)).rejects.toBeDefined();

    // The user clears the conflict and taps Finish again.
    await db.participants.clear();
    await createTripFromOnboarding(input);

    expect(await db.trips.count()).toBe(1);
    expect(await db.participants.count()).toBe(1);
    expect(await db.activityProfiles.count()).toBe(input.profiles.length);
  });
});
