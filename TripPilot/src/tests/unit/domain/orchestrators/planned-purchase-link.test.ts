import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  linkExistingExpenseToPlannedPurchase,
  undoLinkExistingExpense,
} from '@/domain/orchestrators';
import {
  createPlannedPurchase,
  plannedPurchaseReservedRemainingCents,
} from '@/domain/planning/planned-purchases';
import { createExpenseTransaction, type CreateExpenseInput } from '@/domain/transactions';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { Transaction } from '@/domain/types/transaction';

// DEC-175 (B9): attribute an EXISTING expense to a planned purchase without
// creating a new transaction. The reserve must shrink by the linked spend
// exactly once (no double counting), reusing the pure auto-close rule. Tested
// against the real (fake-indexeddb) db.

const POOL = 'pool-1';

function mkPurchase(overrides: Partial<PlannedPurchase> = {}): PlannedPurchase {
  return {
    ...createPlannedPurchase({
      tripId: 'trip-1',
      budgetPoolId: POOL,
      name: 'Skincare',
      category: 'health',
      estimatedCostCents: 10000,
      reservedCents: 10000,
    }),
    ...overrides,
  };
}

function mkExpense(amountCents: number, overrides: Partial<CreateExpenseInput> = {}): Transaction {
  return createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: POOL,
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'health',
    description: 'Cream',
    ...overrides,
  });
}

describe('linkExistingExpenseToPlannedPurchase (DEC-175 / B9)', () => {
  beforeEach(async () => {
    await Promise.all([db.plannedPurchases.clear(), db.transactions.clear()]);
  });

  it('links an existing expense without creating a new transaction', async () => {
    const purchase = mkPurchase();
    const tx = mkExpense(4000);
    await db.plannedPurchases.put(purchase);
    await db.transactions.put(tx);

    const txCountBefore = await db.transactions.count();
    const result = await linkExistingExpenseToPlannedPurchase({ purchase, transaction: tx });
    const txCountAfter = await db.transactions.count();

    expect(txCountAfter).toBe(txCountBefore); // no new transaction created
    expect(result.purchase.linkedTransactionIds).toContain(tx.id);
    // reserve shrinks by the linked spend: €100 − €40 = €60
    expect(plannedPurchaseReservedRemainingCents(result.purchase, [tx])).toBe(6000);
    expect(result.purchase.status).toBe('planned');

    const persisted = await db.plannedPurchases.get(purchase.id);
    expect(persisted!.linkedTransactionIds).toContain(tx.id);
  });

  it('auto-closes when the linked spend fully consumes the reserve', async () => {
    const purchase = mkPurchase({ reservedCents: 5000, estimatedCostCents: 5000 });
    const tx = mkExpense(5000);
    await db.plannedPurchases.put(purchase);
    await db.transactions.put(tx);

    const result = await linkExistingExpenseToPlannedPurchase({ purchase, transaction: tx });
    expect(result.purchase.status).toBe('bought');
    expect(plannedPurchaseReservedRemainingCents(result.purchase, [tx])).toBe(0);
  });

  it('never auto-closes a track-only purchase (no reserve to deplete)', async () => {
    const purchase = mkPurchase({ reservedCents: null });
    const tx = mkExpense(9999);
    await db.plannedPurchases.put(purchase);
    await db.transactions.put(tx);

    const result = await linkExistingExpenseToPlannedPurchase({ purchase, transaction: tx });
    expect(result.purchase.status).toBe('planned');
  });

  it('accounts prior linked spend across stores (no double counting)', async () => {
    const first = mkExpense(3000);
    const purchase = mkPurchase({ linkedTransactionIds: [first.id] });
    const second = mkExpense(3000);
    await db.plannedPurchases.put(purchase);
    await db.transactions.bulkPut([first, second]);

    const result = await linkExistingExpenseToPlannedPurchase({ purchase, transaction: second });
    expect(result.purchase.linkedTransactionIds).toEqual([first.id, second.id]);
    // remaining = €100 − (€30 + €30) = €40
    expect(plannedPurchaseReservedRemainingCents(result.purchase, [first, second])).toBe(4000);
  });

  it('undo restores the pre-link snapshot', async () => {
    const purchase = mkPurchase();
    const tx = mkExpense(4000);
    await db.plannedPurchases.put(purchase);
    await db.transactions.put(tx);

    const result = await linkExistingExpenseToPlannedPurchase({ purchase, transaction: tx });
    expect((await db.plannedPurchases.get(purchase.id))!.linkedTransactionIds).toContain(tx.id);

    await undoLinkExistingExpense(result.previousPurchase);
    const restored = await db.plannedPurchases.get(purchase.id);
    expect(restored!.linkedTransactionIds).not.toContain(tx.id);
    expect(restored!.status).toBe('planned');
  });
});
