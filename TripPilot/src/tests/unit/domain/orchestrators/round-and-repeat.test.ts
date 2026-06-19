import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { addRoundExpenses, repeatLastSessionItem, registerExpense } from '@/domain/orchestrators';
import { createSession, createSessionItem, calculateSessionTotal } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { resolvePayerExpense } from '@/domain/splitting';

const OWNER = 'owner-1';
const FRIEND = 'friend-1';

const mkSession = () =>
  createSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    activityProfileId: 'p-bar',
    name: 'Bar night',
    limits: { targetCents: 1500, ceilingCents: 2500, maxCents: 3500, avgDrinkPriceCents: 500 },
    quickAddValuesCents: [300, 500, 700, 1000, 1500],
  });

describe('addRoundExpenses (M8)', () => {
  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.sessionItems.clear(),
      db.sessions.clear(),
      db.participantShares.clear(),
    ]);
  });

  it('"round of 4 I paid" creates 4 items totalling €20', async () => {
    const session = mkSession();
    await db.sessions.add(session);

    const txs = await addRoundExpenses({
      session,
      count: 4,
      unitPriceCents: 500,
      phaseId: session.phaseId,
      currency: 'EUR',
      profileCategory: 'bar',
      split: null,
    });

    expect(txs).toHaveLength(4);
    expect(calculateSessionTotal(txs)).toBe(2000);
    txs.forEach((tx) => {
      expect(tx).toMatchObject({ amountCents: 500, personalCostCents: 500, isShared: false });
    });

    const items = await db.sessionItems.where('sessionId').equals(session.id).sortBy('order');
    expect(items.map((i) => i.order)).toEqual([1, 2, 3, 4]);
    const shares = await db.participantShares.toArray();
    expect(shares).toHaveLength(0);
  });

  it('"split round" divides each drink among the group (DEC-047/114)', async () => {
    const session = mkSession();
    await db.sessions.add(session);

    const txs = await addRoundExpenses({
      session,
      count: 4,
      unitPriceCents: 500,
      phaseId: session.phaseId,
      currency: 'EUR',
      profileCategory: 'bar',
      split: { ownerId: OWNER, payerId: OWNER, participantIds: [OWNER, FRIEND] },
    });

    // Owner's personal cost = one share per drink = €2,50 × 4 = €10.
    expect(calculateSessionTotal(txs)).toBe(1000);
    txs.forEach((tx) => {
      expect(tx).toMatchObject({ amountCents: 500, personalCostCents: 250, isShared: true });
      expect(tx.paidByParticipantId).toBe(OWNER);
    });

    // 4 drinks × 2 participants = 8 shares. DEC-241: a non-connected friend (no
    // actorId) owes immediately, so every slice is born confirmed.
    const shares = await db.participantShares.toArray();
    expect(shares).toHaveLength(8);
    const ownerShares = shares.filter((s) => s.participantId === OWNER);
    const friendShares = shares.filter((s) => s.participantId === FRIEND);
    expect(ownerShares.every((s) => s.confirmationStatus === 'confirmed')).toBe(true);
    expect(friendShares.every((s) => s.confirmationStatus === 'confirmed')).toBe(true);
  });

  it('continues the item order after existing items', async () => {
    const session = mkSession();
    await db.sessions.add(session);
    const existing = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 300,
      currency: 'EUR',
      category: 'bar',
      description: 'Bar night',
      sessionId: session.id,
    });
    await db.transactions.add(existing);
    await db.sessionItems.add(createSessionItem(session.id, existing.id, 1));

    await addRoundExpenses({
      session,
      count: 2,
      unitPriceCents: 500,
      phaseId: session.phaseId,
      currency: 'EUR',
      profileCategory: 'bar',
      split: null,
    });

    const items = await db.sessionItems.where('sessionId').equals(session.id).sortBy('order');
    expect(items.map((i) => i.order)).toEqual([1, 2, 3]);
  });
});

describe('repeatLastSessionItem (M7)', () => {
  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.sessionItems.clear(),
      db.sessions.clear(),
      db.participantShares.clear(),
    ]);
  });

  it('repeats a simple item identically', async () => {
    const session = mkSession();
    await db.sessions.add(session);
    const last = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'wallet-1',
      amountCents: 450,
      currency: 'EUR',
      category: 'bar',
      subcategoryId: 'bar_beer',
      description: 'Beer',
      sessionId: session.id,
    });
    await db.transactions.add(last);
    await db.sessionItems.add(createSessionItem(session.id, last.id, 1));

    const repeated = await repeatLastSessionItem({
      session,
      lastTx: last,
      lastShares: [],
      phaseId: session.phaseId,
      currency: 'EUR',
      ownerId: OWNER,
    });

    expect(repeated.id).not.toBe(last.id);
    expect(repeated).toMatchObject({
      amountCents: 450,
      personalCostCents: 450,
      category: 'bar',
      subcategoryId: 'bar_beer',
      description: 'Beer',
      isShared: false,
      sessionId: session.id,
    });
    const items = await db.sessionItems.where('sessionId').equals(session.id).sortBy('order');
    expect(items.map((i) => i.order)).toEqual([1, 2]);
  });

  it('repeats a shared item respecting the split (DEC-114)', async () => {
    const session = mkSession();
    await db.sessions.add(session);

    // Original: €10 split equally between owner and friend, owner paid.
    const original = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 1000,
      currency: 'EUR',
      category: 'bar',
      description: 'Round',
      sessionId: session.id,
      isShared: true,
      paidByParticipantId: OWNER,
    });
    const resolution = resolvePayerExpense({
      transactionId: original.id,
      amountCents: 1000,
      ownerId: OWNER,
      payerId: OWNER,
      didSplit: true,
      participantIds: [OWNER, FRIEND],
      shareType: 'equal',
      customAmountsCents: {},
    });
    original.personalCostCents = resolution.personalCostCents;
    await registerExpense({ transaction: original, shares: resolution.shares });
    await db.sessionItems.add(createSessionItem(session.id, original.id, 1));

    const repeated = await repeatLastSessionItem({
      session,
      lastTx: original,
      lastShares: resolution.shares,
      phaseId: session.phaseId,
      currency: 'EUR',
      ownerId: OWNER,
    });

    expect(repeated).toMatchObject({
      amountCents: 1000,
      personalCostCents: 500,
      isShared: true,
      paidByParticipantId: OWNER,
    });
    const newShares = await db.participantShares
      .where('transactionId')
      .equals(repeated.id)
      .toArray();
    expect(newShares).toHaveLength(2);
    expect(newShares.find((s) => s.participantId === OWNER)?.confirmationStatus).toBe('confirmed');
    // DEC-241: non-connected friend → real debt immediately (born confirmed).
    expect(newShares.find((s) => s.participantId === FRIEND)?.confirmationStatus).toBe('confirmed');
  });
});
