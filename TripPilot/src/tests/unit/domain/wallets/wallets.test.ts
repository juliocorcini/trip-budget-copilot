import { describe, it, expect } from 'vitest';
import {
  calculateWalletBalance,
  calculateCashReconciliation,
  getUnassignedTransactionCount,
  hasWiseImportedTransactions,
  countActiveWallets,
  isWalletTrackingActive,
} from '@/domain/wallets';
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

// ── GATE 5 (D10) — progressive wallet tracking ──
const mkWallet = (id: string, overrides: Partial<Wallet> = {}): Wallet => ({
  ...wallet,
  id,
  isDefault: id === 'w1',
  ...overrides,
});

describe('countActiveWallets', () => {
  it('counts only live wallets', () => {
    expect(countActiveWallets([mkWallet('w1'), mkWallet('w2')])).toBe(2);
  });

  it('ignores soft-deleted wallets', () => {
    expect(
      countActiveWallets([
        mkWallet('w1'),
        mkWallet('w2', { deletedAt: '2026-02-01T00:00:00.000Z' }),
      ]),
    ).toBe(1);
  });

  it('is 0 for an empty list', () => {
    expect(countActiveWallets([])).toBe(0);
  });
});

describe('hasWiseImportedTransactions', () => {
  it('is true when a live transaction carries a Wise external ref', () => {
    const txs: Transaction[] = [
      mkTx('t1', 1000, 'w1'),
      { ...mkTx('t2', 2000, 'w1'), externalRef: 'wise:CARD-3927313014' },
    ];
    expect(hasWiseImportedTransactions(txs)).toBe(true);
  });

  it('is false when no transaction was imported from Wise', () => {
    expect(hasWiseImportedTransactions([mkTx('t1', 1000, 'w1')])).toBe(false);
  });

  it('ignores a non-Wise external ref', () => {
    const txs: Transaction[] = [{ ...mkTx('t1', 1000, 'w1'), externalRef: 'manual:123' }];
    expect(hasWiseImportedTransactions(txs)).toBe(false);
  });

  it('ignores a soft-deleted Wise transaction', () => {
    const txs: Transaction[] = [
      {
        ...mkTx('t1', 1000, 'w1'),
        externalRef: 'wise:CARD-1',
        deletedAt: '2026-02-01T00:00:00.000Z',
      },
    ];
    expect(hasWiseImportedTransactions(txs)).toBe(false);
  });
});

describe('isWalletTrackingActive (D10)', () => {
  const oneWallet = [mkWallet('w1')];
  const twoWallets = [mkWallet('w1'), mkWallet('w2')];

  it('AUTO: stays off for a single-source traveler (1 wallet, no import)', () => {
    expect(isWalletTrackingActive(oneWallet, null, false)).toBe(false);
  });

  it('AUTO: lights up with 2+ wallets', () => {
    expect(isWalletTrackingActive(twoWallets, null, false)).toBe(true);
  });

  it('AUTO: lights up with a Wise import even on a single wallet', () => {
    expect(isWalletTrackingActive(oneWallet, null, true)).toBe(true);
  });

  it('AUTO: a soft-deleted second wallet does not light it up', () => {
    const wallets = [mkWallet('w1'), mkWallet('w2', { deletedAt: '2026-02-01T00:00:00.000Z' })];
    expect(isWalletTrackingActive(wallets, null, false)).toBe(false);
  });

  it('AUTO: stays off with no wallets and no import', () => {
    expect(isWalletTrackingActive([], null, false)).toBe(false);
  });

  it('override TRUE forces it on even with a single wallet and no import', () => {
    expect(isWalletTrackingActive(oneWallet, true, false)).toBe(true);
  });

  it('override FALSE forces it off even with many wallets and a Wise import', () => {
    expect(isWalletTrackingActive(twoWallets, false, true)).toBe(false);
  });
});
