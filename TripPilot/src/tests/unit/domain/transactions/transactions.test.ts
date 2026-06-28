import { describe, it, expect } from 'vitest';
import {
  createExpenseTransaction,
  createTransferTransaction,
  createAdjustmentTransaction,
  calculateSpentOnDate,
  spentByCategoryOnDate,
  sumExpensesInMonth,
} from '@/domain/transactions';
import { calculateReportedTotalDiff } from '@/domain/outing';
import { calculateWalletBalance, calculateCashReconciliation } from '@/domain/wallets';
import type { Transaction } from '@/domain/types/transaction';
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

  it('defaults occurrenceId to null (no event attribution)', () => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'w1',
      amountCents: 1000,
      currency: 'EUR',
      category: 'bar',
      description: 'Drinks',
    });
    expect(tx.occurrenceId).toBeNull();
  });

  it('DEC-386: attributes the spend to an event and DROPS the session (event XOR session)', () => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'w1',
      amountCents: 1000,
      currency: 'EUR',
      category: 'bar',
      description: 'Drinks',
      occurrenceId: 'evt-1',
      sessionId: 'sess-1',
    });
    expect(tx.occurrenceId).toBe('evt-1');
    expect(tx.sessionId).toBeNull();
  });

  it('keeps the session when there is no event attribution', () => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'w1',
      amountCents: 1000,
      currency: 'EUR',
      category: 'bar',
      description: 'Drinks',
      sessionId: 'sess-1',
    });
    expect(tx.sessionId).toBe('sess-1');
    expect(tx.occurrenceId).toBeNull();
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

describe('spentByCategoryOnDate (GATE 19 — per-day category breakdown)', () => {
  const mkExpense = (
    amountCents: number,
    dayIso: string,
    category: string | null,
  ): Transaction => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents,
      currency: 'EUR',
      category: category ?? 'other',
      description: 'test',
    });
    return { ...tx, category, date: `${dayIso}T14:00:00.000Z` };
  };

  it('groups a day by category, sorted by spend desc, summing to the day total', () => {
    const txs = [
      mkExpense(1_000, '2026-06-13', 'bar'),
      mkExpense(6_000, '2026-06-13', 'market'),
      mkExpense(500, '2026-06-13', 'bar'),
      mkExpense(300, '2026-06-13', 'transport'),
      mkExpense(2_000, '2026-06-14', 'market'), // a different day — must be ignored
    ];

    const rows = spentByCategoryOnDate(txs, '2026-06-13');

    expect(rows.map((r) => r.category)).toEqual(['market', 'bar', 'transport']);
    expect(rows[0]).toMatchObject({ category: 'market', totalCents: 6_000, count: 1 });
    expect(rows[1]).toMatchObject({ category: 'bar', totalCents: 1_500, count: 2 });
    expect(rows[2]).toMatchObject({ category: 'transport', totalCents: 300, count: 1 });

    // The categories always reconcile to the heatmap day total.
    const sum = rows.reduce((acc, r) => acc + r.totalCents, 0);
    expect(sum).toBe(calculateSpentOnDate(txs, '2026-06-13'));
    expect(sum).toBe(7_800);
  });

  it('buckets null categories into "other"', () => {
    const txs = [mkExpense(2_500, '2026-06-13', null), mkExpense(700, '2026-06-13', 'bar')];
    const rows = spentByCategoryOnDate(txs, '2026-06-13');
    const other = rows.find((r) => r.category === 'other');
    expect(other?.totalCents).toBe(2_500);
  });

  it('ignores deleted transactions and other days', () => {
    const live = mkExpense(1_000, '2026-06-13', 'bar');
    const deleted: Transaction = { ...mkExpense(9_000, '2026-06-13', 'market'), deletedAt: '2026-06-13T15:00:00.000Z' };
    const rows = spentByCategoryOnDate([live, deleted], '2026-06-13');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'bar', totalCents: 1_000 });
  });

  it('returns an empty list for a day with no spend', () => {
    const txs = [mkExpense(1_000, '2026-06-13', 'bar')];
    expect(spentByCategoryOnDate(txs, '2026-06-10')).toEqual([]);
  });
});

describe('sumExpensesInMonth (DEC-251 — continuous home)', () => {
  const mkExpense = (amountCents: number, dayIso: string): Transaction => {
    const tx = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents,
      currency: 'EUR',
      category: 'market',
      description: 'test',
    });
    return { ...tx, date: `${dayIso}T14:00:00.000Z` };
  };

  it('sums only the expenses whose local day falls in the given month', () => {
    const txs = [
      mkExpense(1_000, '2026-06-01'),
      mkExpense(2_500, '2026-06-30'),
      mkExpense(9_999, '2026-05-31'), // previous month — excluded
      mkExpense(7_777, '2026-07-01'), // next month — excluded
    ];
    expect(sumExpensesInMonth(txs, '2026-06')).toBe(3_500);
  });

  it('ignores soft-deleted transactions', () => {
    const live = mkExpense(1_000, '2026-06-10');
    const deleted: Transaction = {
      ...mkExpense(5_000, '2026-06-11'),
      deletedAt: '2026-06-12T00:00:00.000Z',
    };
    expect(sumExpensesInMonth([live, deleted], '2026-06')).toBe(1_000);
  });

  it('counts a foreign expense at its frozen base-currency value', () => {
    // 100.00 USD at rate 0.9 → 90.00 EUR base personal cost.
    const foreign: Transaction = {
      ...mkExpense(10_000, '2026-06-05'),
      currency: 'USD',
      exchangeRate: 0.9,
      personalCostCents: 10_000,
    };
    expect(sumExpensesInMonth([foreign], '2026-06')).toBe(9_000);
  });

  it('returns 0 for a month with no expenses', () => {
    expect(sumExpensesInMonth([mkExpense(1_000, '2026-06-01')], '2026-09')).toBe(0);
  });
});
