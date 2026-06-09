import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  transferBetweenWallets,
  withdrawCash,
  reconcileWallet,
} from '@/domain/orchestrators';

const baseTransfer = {
  tripId: 'trip-1',
  phaseId: 'phase-1',
  sourceWalletId: 'wallet-bank',
  targetWalletId: 'wallet-cash',
  amountCents: 5000,
  currency: 'EUR',
  description: 'Withdrawal',
};

describe('wallet orchestrators (GAP-030 / D-H)', () => {
  beforeEach(async () => {
    await db.transactions.clear();
  });

  it('transferBetweenWallets never touches the budget (Core Rule 3)', async () => {
    const tx = await transferBetweenWallets(baseTransfer);
    expect(tx.type).toBe('transfer');
    expect(tx.budgetPoolId).toBeNull();
    expect(tx.personalCostCents).toBeNull();
    expect(tx.sourceWalletId).toBe('wallet-bank');
    expect(tx.targetWalletId).toBe('wallet-cash');
    expect(await db.transactions.count()).toBe(1);
  });

  it('transferBetweenWallets rejects same source and target', async () => {
    await expect(
      transferBetweenWallets({ ...baseTransfer, targetWalletId: 'wallet-bank' }),
    ).rejects.toThrow();
    expect(await db.transactions.count()).toBe(0);
  });

  it('withdrawCash persists a bank→cash transfer with null budget pool', async () => {
    const tx = await withdrawCash(baseTransfer);
    expect(tx.budgetPoolId).toBeNull();
    const stored = await db.transactions.get(tx.id);
    expect(stored?.type).toBe('transfer');
  });

  it('reconcileWallet creates a positive adjustment for missing cash (DEC-052)', async () => {
    const tx = await reconcileWallet({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'wallet-cash',
      expectedBalanceCents: 10000,
      countedBalanceCents: 8500,
      currency: 'EUR',
      reason: 'Untracked spending',
    });
    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('adjustment');
    expect(tx!.amountCents).toBe(1500);
  });

  it('reconcileWallet creates a negative adjustment for surplus cash', async () => {
    const tx = await reconcileWallet({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'wallet-cash',
      expectedBalanceCents: 8000,
      countedBalanceCents: 9000,
      currency: 'EUR',
      reason: 'Correction',
    });
    expect(tx!.amountCents).toBe(-1000);
  });

  it('reconcileWallet returns null when balances match', async () => {
    const tx = await reconcileWallet({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'wallet-cash',
      expectedBalanceCents: 5000,
      countedBalanceCents: 5000,
      currency: 'EUR',
      reason: 'No-op',
    });
    expect(tx).toBeNull();
    expect(await db.transactions.count()).toBe(0);
  });
});
