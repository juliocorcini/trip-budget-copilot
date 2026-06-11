import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { quickAddSessionExpense, assignTransactionSubcategory } from '@/domain/orchestrators';
import { createSession, createSessionItem } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';

// DEC-120 (R-11): quick-add reachable from the notification bridge.

const mkSession = () =>
  createSession({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    activityProfileId: 'p-bar',
    name: 'Bar night',
    limits: { targetCents: 1500, ceilingCents: 2500, maxCents: 3500, avgDrinkPriceCents: 500 },
    quickAddValuesCents: [300, 500],
  });

describe('quickAddSessionExpense', () => {
  beforeEach(async () => {
    await Promise.all([db.transactions.clear(), db.sessionItems.clear(), db.sessions.clear()]);
  });

  it('creates the expense and the session item atomically', async () => {
    const session = mkSession();
    await db.sessions.add(session);

    const tx = await quickAddSessionExpense({
      session,
      amountCents: 500,
      phaseId: session.phaseId,
      currency: 'EUR',
      profileCategory: 'bar',
    });

    const stored = await db.transactions.get(tx.id);
    expect(stored).toMatchObject({
      sessionId: session.id,
      amountCents: 500,
      personalCostCents: 500,
      category: 'bar',
      description: 'Bar night',
      type: 'expense',
      walletId: null,
    });

    const items = await db.sessionItems.where('sessionId').equals(session.id).toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ transactionId: tx.id, order: 1 });
  });

  it('derives the item order from the existing items', async () => {
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

    const tx = await quickAddSessionExpense({
      session,
      amountCents: 500,
      phaseId: session.phaseId,
      currency: 'EUR',
      profileCategory: 'bar',
    });

    const items = await db.sessionItems.where('sessionId').equals(session.id).sortBy('order');
    expect(items.map((i) => i.transactionId)).toEqual([existing.id, tx.id]);
    expect(items[1]!.order).toBe(2);
  });
});

describe('assignTransactionSubcategory', () => {
  beforeEach(async () => {
    await db.transactions.clear();
  });

  it('sets the subcategory with a revision bump', async () => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 500,
      currency: 'EUR',
      category: 'bar',
      description: 'Bar night',
    });
    await db.transactions.add(tx);

    await assignTransactionSubcategory(tx.id, 'bar_beer');

    const stored = await db.transactions.get(tx.id);
    expect(stored!.subcategoryId).toBe('bar_beer');
    expect(stored!.revision).toBe(tx.revision + 1);
  });

  it('ignores missing or deleted transactions', async () => {
    await expect(assignTransactionSubcategory('ghost', 'bar_beer')).resolves.toBeUndefined();
  });
});
