import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  addPlannedPurchase,
  updatePlannedPurchase,
  setPlannedPurchaseStatus,
  deletePlannedPurchase,
  restorePlannedPurchase,
  logPlannedPurchaseExpense,
  undoLogPlannedPurchaseExpense,
} from '@/domain/orchestrators';
import { plannedPurchaseRepository } from '@/data/repositories';
import type { CreateExpenseInput } from '@/domain/transactions';

// DEC-175: planned purchase orchestrators against the real (fake-indexeddb) db.

const mkInput = (overrides: Record<string, unknown> = {}) => ({
  tripId: 'trip-1',
  budgetPoolId: 'pool-1',
  name: 'Skincare creams',
  category: 'shopping',
  estimatedCostCents: 15000,
  ...overrides,
});

const mkExpense = (amountCents: number): CreateExpenseInput => ({
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: null,
  amountCents,
  currency: 'EUR',
  category: 'shopping',
  description: 'Creams',
});

describe('planned purchase orchestrators (DEC-175)', () => {
  beforeEach(async () => {
    await Promise.all([
      db.plannedPurchases.clear(),
      db.transactions.clear(),
      db.participantShares.clear(),
    ]);
  });

  it('adds a planned purchase with the reserve defaulting to the estimate', async () => {
    const created = await addPlannedPurchase(mkInput());
    const stored = await plannedPurchaseRepository.getByTripId('trip-1');
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(created.id);
    expect(stored[0]!.reservedCents).toBe(15000);
    expect(stored[0]!.status).toBe('planned');
  });

  it('updates an existing planned purchase', async () => {
    const created = await addPlannedPurchase(mkInput());
    await updatePlannedPurchase({ ...created, name: 'Winter coat', estimatedCostCents: 20000 });
    const stored = await plannedPurchaseRepository.getById(created.id);
    expect(stored!.name).toBe('Winter coat');
    expect(stored!.estimatedCostCents).toBe(20000);
  });

  it('cancels a purchase via status change', async () => {
    const created = await addPlannedPurchase(mkInput());
    await setPlannedPurchaseStatus(created, 'cancelled');
    const stored = await plannedPurchaseRepository.getById(created.id);
    expect(stored!.status).toBe('cancelled');
  });

  it('soft-deletes and restores a planned purchase', async () => {
    const created = await addPlannedPurchase(mkInput());
    await deletePlannedPurchase(created.id);
    expect(await plannedPurchaseRepository.getByTripId('trip-1')).toHaveLength(0);

    await restorePlannedPurchase(created);
    const restored = await plannedPurchaseRepository.getByTripId('trip-1');
    expect(restored).toHaveLength(1);
    expect(restored[0]!.id).toBe(created.id);
  });

  it('logs a purchase expense, links it, and force-closes when asked (Comprei)', async () => {
    const created = await addPlannedPurchase(mkInput({ estimatedCostCents: 15000 }));
    const result = await logPlannedPurchaseExpense({
      purchase: created,
      expense: mkExpense(5000),
      close: true,
    });

    // a real transaction now exists and is linked
    const tx = await db.transactions.get(result.transaction.id);
    expect(tx).toBeDefined();
    expect(tx!.amountCents).toBe(5000);

    const stored = await plannedPurchaseRepository.getById(created.id);
    expect(stored!.linkedTransactionIds).toEqual([result.transaction.id]);
    expect(stored!.status).toBe('bought'); // forced closed
  });

  it('keeps the purchase open when reserve remains and close is false', async () => {
    const created = await addPlannedPurchase(mkInput({ estimatedCostCents: 15000 }));
    await logPlannedPurchaseExpense({ purchase: created, expense: mkExpense(5000), close: false });
    const stored = await plannedPurchaseRepository.getById(created.id);
    expect(stored!.status).toBe('planned'); // 10000 reserve still remains
  });

  it('auto-closes once linked spend consumes the reserve (close false)', async () => {
    const created = await addPlannedPurchase(mkInput({ estimatedCostCents: 5000 }));
    await logPlannedPurchaseExpense({ purchase: created, expense: mkExpense(5000), close: false });
    const stored = await plannedPurchaseRepository.getById(created.id);
    expect(stored!.status).toBe('bought');
  });

  it('accounts for prior linked spend across multiple buys (multi-store)', async () => {
    const created = await addPlannedPurchase(mkInput({ estimatedCostCents: 15000 }));
    const first = await logPlannedPurchaseExpense({
      purchase: created,
      expense: mkExpense(6000),
      close: false,
    });
    expect(first.purchase.status).toBe('planned');

    // second buy uses the UPDATED purchase (carries the first link)
    const second = await logPlannedPurchaseExpense({
      purchase: first.purchase,
      expense: mkExpense(9000),
      close: false,
    });
    // 6000 + 9000 = 15000 → reserve consumed → auto-closed
    expect(second.purchase.status).toBe('bought');
    const stored = await plannedPurchaseRepository.getById(created.id);
    expect(stored!.linkedTransactionIds).toHaveLength(2);
  });

  it('undoes a logged purchase expense (deletes tx, restores purchase)', async () => {
    const created = await addPlannedPurchase(mkInput({ estimatedCostCents: 15000 }));
    const result = await logPlannedPurchaseExpense({
      purchase: created,
      expense: mkExpense(5000),
      close: true,
    });

    await undoLogPlannedPurchaseExpense({
      transactionId: result.transaction.id,
      previousPurchase: result.previousPurchase,
    });

    const tx = await db.transactions.get(result.transaction.id);
    expect(tx!.deletedAt).not.toBeNull(); // soft-deleted

    const stored = await plannedPurchaseRepository.getById(created.id);
    expect(stored!.status).toBe('planned'); // back to pre-buy state
    expect(stored!.linkedTransactionIds).toEqual([]);
  });
});
