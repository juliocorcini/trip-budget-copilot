import { describe, it, expect } from 'vitest';
import { calculateWalletBalance, calculateCashReconciliation, getUnassignedTransactionCount } from '@/domain/wallets';
import type { Wallet } from '@/domain/types/wallet';
import type { Transaction } from '@/domain/types/transaction';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

const wallet: Wallet = {
  ...baseMeta,
  id: 'w1',
  tripId: 'trip-1',
  name: 'Wise',
  walletType: 'digital',
  currency: 'EUR',
  initialBalanceCents: 100000,
  isDefault: true,
  notes: null,
};

const mkTx = (id: string, amount: number, walletId: string | null, type: string = 'expense'): Transaction => ({
  ...baseMeta,
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId,
  sessionId: null,
  type: type as Transaction['type'],
  amountCents: amount,
  personalCostCents: amount,
  currency: 'EUR',
  baseCurrencyAmountCents: amount,
  exchangeRate: null,
  category: 'bar',
  subcategoryId: null,
  placeLabel: null,
  latitude: null,
  longitude: null,
  placeId: null,
  description: 'test',
  date: '2026-01-01T00:00:00.000Z',
  isShared: false,
  paidByParticipantId: null,
  activityProfileId: null,
  isSpecialOccasion: false,
  excludeFromLearning: false,
  sourceWalletId: type === 'transfer' ? walletId : null,
  targetWalletId: null,
  settlementId: null,
  adjustmentReason: null,
  notes: null,
});

describe('calculateWalletBalance', () => {
  it('computes balance from initial + transfers - expenses', () => {
    const txs: Transaction[] = [
      mkTx('t1', 5000, 'w1'),
      mkTx('t2', 3000, 'w1'),
    ];
    const balance = calculateWalletBalance(wallet, txs, 'EUR');
    expect(balance.initialBalanceCents).toBe(100000);
    expect(balance.outgoingCents).toBe(8000);
    expect(balance.currentBalanceCents).toBe(92000);
  });

  it('includes incoming transfers', () => {
    const txs: Transaction[] = [
      { ...mkTx('t1', 10000, 'w2', 'transfer'), sourceWalletId: 'w2', targetWalletId: 'w1' },
    ];
    const balance = calculateWalletBalance(wallet, txs, 'EUR');
    expect(balance.incomingCents).toBe(10000);
    expect(balance.currentBalanceCents).toBe(110000);
  });
});

describe('calculateWalletBalance (multi-currency — E9 M10)', () => {
  const eurWallet: Wallet = { ...wallet, id: 'eur', currency: 'EUR', initialBalanceCents: 100000 };
  const czkWallet: Wallet = { ...wallet, id: 'czk', currency: 'CZK', initialBalanceCents: 500000 };
  const gbpWallet: Wallet = { ...wallet, id: 'gbp', currency: 'GBP', initialBalanceCents: 100000 };

  // 1000.00 CZK ≈ 40.00 EUR at rate 0.04 (base per 1 foreign).
  const foreignExpense = (walletId: string): Transaction => ({
    ...mkTx('fx', 100000, walletId),
    currency: 'CZK',
    baseCurrencyAmountCents: 4000,
    exchangeRate: 0.04,
  });

  it('debits the CONVERTED base value from a base-currency wallet', () => {
    const balance = calculateWalletBalance(eurWallet, [foreignExpense('eur')], 'EUR');
    expect(balance.outgoingCents).toBe(4000);
    expect(balance.currentBalanceCents).toBe(96000); // 100000 - 4000
  });

  it('debits the ORIGINAL amount when the wallet shares the expense currency', () => {
    const balance = calculateWalletBalance(czkWallet, [foreignExpense('czk')], 'EUR');
    expect(balance.outgoingCents).toBe(100000);
    expect(balance.currentBalanceCents).toBe(400000); // 500000 - 100000
  });

  it('falls back to the original amount for the unsupported triple-edge wallet', () => {
    // Wallet is neither the base (EUR) nor the expense currency (CZK).
    const balance = calculateWalletBalance(gbpWallet, [foreignExpense('gbp')], 'EUR');
    expect(balance.outgoingCents).toBe(100000);
  });
});

describe('calculateCashReconciliation', () => {
  it('detects positive difference', () => {
    const result = calculateCashReconciliation(5000, 5500);
    expect(result.differenceCents).toBe(500);
    expect(result.needsAdjustment).toBe(true);
  });

  it('detects no difference', () => {
    const result = calculateCashReconciliation(5000, 5000);
    expect(result.differenceCents).toBe(0);
    expect(result.needsAdjustment).toBe(false);
  });
});

describe('getUnassignedTransactionCount', () => {
  it('counts expenses without wallet', () => {
    const txs: Transaction[] = [
      mkTx('t1', 1000, null),
      mkTx('t2', 2000, 'w1'),
      mkTx('t3', 500, null),
      { ...mkTx('t4', 300, null, 'transfer') },
    ];
    expect(getUnassignedTransactionCount(txs)).toBe(2);
  });
});
