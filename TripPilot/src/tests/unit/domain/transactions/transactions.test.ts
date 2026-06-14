import { describe, it, expect } from 'vitest';
import {
  createExpenseTransaction,
  createTransferTransaction,
  createAdjustmentTransaction,
} from '@/domain/transactions';
import { calculateReportedTotalDiff } from '@/domain/outing';
import { calculateWalletBalance, calculateCashReconciliation } from '@/domain/wallets';
import type { Wallet } from '@/domain/types/wallet';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

const mkWallet = (id: string, type: Wallet['walletType'], initial: number): Wallet => ({
  ...baseMeta,
  id,
  tripId: 'trip-1',
  name: id,
  walletType: type,
  currency: 'EUR',
  initialBalanceCents: initial,
  isDefault: false,
  notes: null,
});

describe('createExpenseTransaction', () => {
  it('defaults personalCostCents to amount for non-shared expenses', () => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'w1',
      amountCents: 4550,
      currency: 'EUR',
      category: 'bar',
      subcategoryId: null,
      description: 'Drinks',
    });
    expect(tx.type).toBe('expense');
    expect(tx.amountCents).toBe(4550);
    expect(tx.personalCostCents).toBe(4550);
    expect(tx.budgetPoolId).toBe('pool-1');
  });

  it('leaves personalCostCents null for shared expenses until shares resolve it', () => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'w1',
      amountCents: 9000,
      currency: 'EUR',
      category: 'restaurant',
      subcategoryId: null,
      description: 'Dinner',
      isShared: true,
    });
    expect(tx.isShared).toBe(true);
    expect(tx.personalCostCents).toBeNull();
  });
});

describe('createTransferTransaction (withdrawal + transfer flows)', () => {
  it('never touches the budget: budgetPoolId and personalCostCents are null', () => {
    const tx = createTransferTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      sourceWalletId: 'bank',
      targetWalletId: 'cash',
      amountCents: 10000,
      currency: 'EUR',
      description: 'ATM withdrawal',
    });
    expect(tx.type).toBe('transfer');
    expect(tx.budgetPoolId).toBeNull();
    expect(tx.personalCostCents).toBeNull();
    expect(tx.sourceWalletId).toBe('bank');
    expect(tx.targetWalletId).toBe('cash');
  });

  it('debits the source wallet and credits the target wallet', () => {
    const bank = mkWallet('bank', 'debit_card', 50000);
    const cash = mkWallet('cash', 'cash', 0);
    const tx = createTransferTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      sourceWalletId: 'bank',
      targetWalletId: 'cash',
      amountCents: 10000,
      currency: 'EUR',
      description: 'ATM withdrawal',
    });
    expect(calculateWalletBalance(bank, [tx], 'EUR').currentBalanceCents).toBe(40000);
    expect(calculateWalletBalance(cash, [tx], 'EUR').currentBalanceCents).toBe(10000);
  });
});

describe('createAdjustmentTransaction (cash reconciliation — DEC-052)', () => {
  it('missing cash becomes a positive adjustment that debits the wallet', () => {
    const cash = mkWallet('cash', 'cash', 10000);
    // expected 10000, counted 8500 → 1500 spent untracked
    const result = calculateCashReconciliation(10000, 8500);
    expect(result.differenceCents).toBe(-1500);
    const tx = createAdjustmentTransaction(
      'trip-1',
      'phase-1',
      'pool-1',
      'cash',
      -result.differenceCents,
      'EUR',
      'Cash reconciliation',
      'bar',
    );
    expect(tx.type).toBe('adjustment');
    expect(tx.amountCents).toBe(1500);
    expect(tx.category).toBe('bar');
    expect(calculateWalletBalance(cash, [tx], 'EUR').currentBalanceCents).toBe(8500);
  });

  it('surplus cash becomes a negative adjustment that credits the wallet', () => {
    const cash = mkWallet('cash', 'cash', 10000);
    // expected 10000, counted 11000 → +1000 correction
    const result = calculateCashReconciliation(10000, 11000);
    const tx = createAdjustmentTransaction(
      'trip-1',
      'phase-1',
      'pool-1',
      'cash',
      -result.differenceCents,
      'EUR',
      'Found extra cash',
    );
    expect(tx.amountCents).toBe(-1000);
    expect(tx.category).toBe('reconciliation');
    expect(tx.adjustmentReason).toBe('Found extra cash');
    expect(calculateWalletBalance(cash, [tx], 'EUR').currentBalanceCents).toBe(11000);
  });
});

describe('calculateReportedTotalDiff (session total — DEC-046)', () => {
  it('items at 3000, reported 4500 → +1500 adjustment (not +4500)', () => {
    const result = calculateReportedTotalDiff(4500, 3000);
    expect(result.diffCents).toBe(1500);
    expect(result.needsAdjustment).toBe(true);
    expect(result.isNegative).toBe(false);
  });

  it('reported below items yields a negative diff that requires confirmation', () => {
    const result = calculateReportedTotalDiff(2000, 3000);
    expect(result.diffCents).toBe(-1000);
    expect(result.isNegative).toBe(true);
  });

  it('matching totals need no adjustment', () => {
    const result = calculateReportedTotalDiff(3000, 3000);
    expect(result.needsAdjustment).toBe(false);
  });
});
