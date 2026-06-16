import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { resetKeepStructure, resetWipeAll } from '@/domain/orchestrators';

/* eslint-disable @typescript-eslint/no-explicit-any */

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

async function seedFullTrip(): Promise<void> {
  await db.table('trips').add({ ...meta, id: 'trip-1', name: 'Trip', baseCurrency: 'EUR', status: 'active' });
  await db.table('phases').add({ ...meta, id: 'phase-1', tripId: 'trip-1', name: 'P1', order: 0 });
  await db.table('budgetPools').add({ ...meta, id: 'pool-1', tripId: 'trip-1', name: 'Fund' });
  await db.table('wallets').add({ ...meta, id: 'wallet-1', tripId: 'trip-1', name: 'Cash', initialBalanceCents: 10000 });
  await db.table('participants').add({ ...meta, id: 'part-1', tripId: 'trip-1', name: 'Me', isOwner: true });

  await db.table('transactions').add({ ...meta, id: 'tx-1', tripId: 'trip-1', amountCents: 500, type: 'expense' });
  await db.table('participantShares').add({ ...meta, id: 'sh-1', transactionId: 'tx-1', participantId: 'part-1' });
  await db.table('sessions').add({ ...meta, id: 'sess-1', tripId: 'trip-1', status: 'closed' });
  await db.table('sessionItems').add({ ...meta, id: 'si-1', sessionId: 'sess-1', transactionId: 'tx-1' });
  await db.table('settlements').add({ ...meta, id: 'set-1', tripId: 'trip-1', debtorParticipantId: 'part-1', creditorParticipantId: 'part-2' });
  await db.table('forecastSnapshots').add({ ...meta, id: 'fc-1', tripId: 'trip-1' });

  await db.table('plannedPurchases').add({
    ...meta,
    id: 'pp-1',
    tripId: 'trip-1',
    budgetPoolId: 'pool-1',
    name: 'Creme',
    status: 'bought',
    linkedTransactionIds: ['tx-1'],
    reservedCents: 5000,
  });
  await db.table('plannedOccurrences').add({
    ...meta,
    id: 'po-1',
    tripId: 'trip-1',
    phaseId: 'phase-1',
    linkedSessionId: 'sess-1',
    reservedCents: 3000,
  });
}

describe('resetKeepStructure', () => {
  beforeEach(clearAll);

  it('clears recorded entries but keeps the trip skeleton', async () => {
    await seedFullTrip();
    await resetKeepStructure();

    // Structure preserved.
    expect(await db.table('trips').count()).toBe(1);
    expect(await db.table('phases').count()).toBe(1);
    expect(await db.table('budgetPools').count()).toBe(1);
    expect(await db.table('wallets').count()).toBe(1);
    expect(await db.table('participants').count()).toBe(1);

    // Entries wiped.
    expect(await db.table('transactions').count()).toBe(0);
    expect(await db.table('participantShares').count()).toBe(0);
    expect(await db.table('sessions').count()).toBe(0);
    expect(await db.table('sessionItems').count()).toBe(0);
    expect(await db.table('settlements').count()).toBe(0);
    expect(await db.table('forecastSnapshots').count()).toBe(0);
  });

  it('reopens planned items and severs their links to the cleared activity', async () => {
    await seedFullTrip();
    await resetKeepStructure();

    const purchase = await db.table('plannedPurchases').get('pp-1');
    expect(purchase.status).toBe('planned');
    expect(purchase.linkedTransactionIds).toEqual([]);
    // Reservation is preserved so the fund still reflects the plan.
    expect(purchase.reservedCents).toBe(5000);

    const occurrence = await db.table('plannedOccurrences').get('po-1');
    expect(occurrence.linkedSessionId).toBeNull();
    expect(occurrence.reservedCents).toBe(3000);
  });
});

describe('resetWipeAll', () => {
  beforeEach(clearAll);

  it('erases everything and re-seeds defaults for onboarding', async () => {
    await seedFullTrip();
    await db.table('appSettings').add({ id: 'app-settings', activeTrip: 'trip-1', onboardingCompleted: true });
    await resetWipeAll();

    expect(await db.table('trips').count()).toBe(0);
    expect(await db.table('transactions').count()).toBe(0);
    expect(await db.table('plannedPurchases').count()).toBe(0);

    const settings = await db.table('appSettings').get('app-settings');
    expect(settings.activeTrip).toBeNull();
    expect(settings.onboardingCompleted).toBe(false);
    // A fresh current device is seeded so the app still has an identity row.
    expect(await db.table('devices').count()).toBe(1);
  });
});
