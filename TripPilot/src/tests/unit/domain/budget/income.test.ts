import { describe, it, expect } from 'vitest';
import {
  calculatePoolIncome,
  calculatePoolSpent,
  calculatePoolRemaining,
  calculateFreeToSpend,
  buildFreeToSpendBreakdown,
  createPoolSummary,
} from '@/domain/budget';
import { calculateWalletBalance } from '@/domain/wallets';
import { createIncomeTransaction } from '@/domain/transactions';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import type { Wallet } from '@/domain/types/wallet';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

const pool: BudgetPool = {
  ...baseMeta,
  id: 'pool-1',
  tripId: 'trip-1',
  name: 'Main Fund',
  scope: 'linked_phases',
  totalAmountCents: 150000,
  currency: 'EUR',
  notes: null,
};

const mkTx = (
  id: string,
  amount: number,
  type: Transaction['type'] = 'expense',
  overrides: Partial<Transaction> = {},
): Transaction => ({
  ...baseMeta,
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: null,
  sessionId: null,
  type,
  amountCents: amount,
  personalCostCents: type === 'income' ? null : amount,
  currency: 'EUR',
  baseCurrencyAmountCents: amount,
  exchangeRate: null,
  category: type === 'income' ? null : 'bar',
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
  excludeFromLearning: type === 'income',
  sourceWalletId: null,
  targetWalletId: null,
  settlementId: null,
  adjustmentReason: null,
  notes: null,
  ...overrides,
});

describe('B8 (DEC-212) — calculatePoolIncome', () => {
  it('sums only income transactions, in base currency', () => {
    const txs = [
      mkTx('i1', 5000, 'income'),
      mkTx('i2', 3000, 'income'),
      mkTx('e1', 9999, 'expense'),
      mkTx('t1', 1000, 'transfer'),
    ];
    expect(calculatePoolIncome(txs)).toBe(8000);
  });

  it('uses the base-currency amount for foreign-currency income', () => {
    // 100 USD received, worth 9200 base cents — the pool grows by the base value.
    const foreign = mkTx('i1', 10000, 'income', {
      currency: 'USD',
      baseCurrencyAmountCents: 9200,
    });
    expect(calculatePoolIncome([foreign])).toBe(9200);
  });

  it('ignores deleted income', () => {
    const txs = [
      mkTx('i1', 5000, 'income'),
      mkTx('i2', 3000, 'income', { deletedAt: '2026-01-02T00:00:00.000Z' }),
    ];
    expect(calculatePoolIncome(txs)).toBe(5000);
  });

  it('is zero when there is no income', () => {
    expect(calculatePoolIncome([mkTx('e1', 5000), mkTx('t1', 1000, 'transfer')])).toBe(0);
    expect(calculatePoolIncome([])).toBe(0);
  });
});

describe('B8 (DEC-212) — calculatePoolSpent invariance', () => {
  it('never counts income as spending', () => {
    const txs = [
      mkTx('e1', 5000, 'expense'),
      mkTx('a1', 1000, 'adjustment'),
      mkTx('i1', 9999, 'income'),
    ];
    // Only expense + adjustment count — income is invisible to "spent".
    expect(calculatePoolSpent(txs)).toBe(6000);
  });
});

describe('B8 (DEC-212) — calculateFreeToSpend with income', () => {
  const envelopes: Envelope[] = [];
  const links: BudgetPoolPhaseLink[] = [];

  it('is bit-identical to the no-income result when income is zero', () => {
    const txs = [mkTx('e1', 25000), mkTx('e2', 18250)];
    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1', [], []);
    expect(result.totalIncomeCents).toBe(0);
    // 150000 - 43250 = 106750 — exactly as before income existed.
    expect(result.freeToSpendCents).toBe(106750);
    expect(result.totalBudgetCents).toBe(150000);
    expect(result.totalSpentCents).toBe(43250);
  });

  it('grows free-to-spend by the income received', () => {
    const txs = [mkTx('e1', 25000), mkTx('e2', 18250), mkTx('i1', 20000, 'income')];
    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1', [], []);
    expect(result.totalIncomeCents).toBe(20000);
    // 150000 + 20000 - 43250 = 126750.
    expect(result.freeToSpendCents).toBe(126750);
  });

  it('can rescue an over-budget phase back into the positive', () => {
    // Spent 160000 against a 150000 budget → would be 0 (clamped). A 30000 top-up
    // lifts it to 150000 + 30000 - 160000 = 20000.
    const txs = [mkTx('e1', 160000), mkTx('i1', 30000, 'income')];
    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1', [], []);
    expect(result.freeToSpendCents).toBe(20000);
  });
});

describe('B8 (DEC-212) — buildFreeToSpendBreakdown income line', () => {
  const links: BudgetPoolPhaseLink[] = [];

  it('omits the income line entirely when there is no income (byte-identical)', () => {
    const fts = calculateFreeToSpend(pool, [], [mkTx('e1', 25000)], links, 'phase-1', [], []);
    const lines = buildFreeToSpendBreakdown(fts);
    expect(lines.some((l) => l.key === 'income')).toBe(false);
  });

  it('adds an additive income line right after the budget when income exists', () => {
    const fts = calculateFreeToSpend(
      pool,
      [],
      [mkTx('e1', 25000), mkTx('i1', 20000, 'income')],
      links,
      'phase-1',
      [],
      [],
    );
    const lines = buildFreeToSpendBreakdown(fts);
    const incomeLine = lines.find((l) => l.key === 'income');
    expect(incomeLine).toBeDefined();
    expect(incomeLine?.kind).toBe('add');
    expect(incomeLine?.cents).toBe(20000);
    // Order: budget (base) → income (add) → … subtractions.
    expect(lines[0]?.key).toBe('budget');
    expect(lines[1]?.key).toBe('income');
  });
});

describe('B8 (DEC-212) — calculatePoolRemaining & createPoolSummary', () => {
  it('grows pool remaining by income', () => {
    const txs = [mkTx('e1', 50000), mkTx('i1', 20000, 'income')];
    // 150000 + 20000 - 50000 = 120000.
    expect(calculatePoolRemaining(pool, txs)).toBe(120000);
  });

  it('reflects income in the pool summary (effective total + %used)', () => {
    const txs = [mkTx('e1', 75000), mkTx('i1', 75000, 'income')];
    const summary = createPoolSummary(pool, txs);
    expect(summary.incomeCents).toBe(75000);
    expect(summary.spentCents).toBe(75000);
    // Effective total 225000; spent 75000 → 33.33% used, remaining 150000.
    expect(summary.remainingCents).toBe(150000);
    expect(summary.percentUsed).toBe(33.33);
  });

  it('keeps the summary unchanged when there is no income (invariance)', () => {
    const txs = [mkTx('e1', 75000)];
    const summary = createPoolSummary(pool, txs);
    expect(summary.incomeCents).toBe(0);
    expect(summary.spentCents).toBe(75000);
    expect(summary.remainingCents).toBe(75000);
    expect(summary.percentUsed).toBe(50);
  });
});

describe('B8 (DEC-212) — calculateWalletBalance credits income', () => {
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

  it('adds income that lands in the wallet', () => {
    const txs = [mkTx('i1', 25000, 'income', { walletId: 'w1' })];
    const balance = calculateWalletBalance(wallet, txs, 'EUR');
    expect(balance.incomingCents).toBe(25000);
    expect(balance.currentBalanceCents).toBe(125000);
  });

  it('ignores income credited to a different wallet', () => {
    const txs = [mkTx('i1', 25000, 'income', { walletId: 'w2' })];
    const balance = calculateWalletBalance(wallet, txs, 'EUR');
    expect(balance.incomingCents).toBe(0);
    expect(balance.currentBalanceCents).toBe(100000);
  });

  it('combines income with transfers and expenses correctly', () => {
    const txs = [
      mkTx('e1', 10000, 'expense', { walletId: 'w1' }),
      mkTx('i1', 30000, 'income', { walletId: 'w1' }),
      { ...mkTx('t1', 5000, 'transfer', { walletId: 'w2' }), sourceWalletId: 'w2', targetWalletId: 'w1' },
    ];
    const balance = calculateWalletBalance(wallet, txs, 'EUR');
    // 100000 + (30000 income + 5000 transfer in) - 10000 expense = 125000.
    expect(balance.incomingCents).toBe(35000);
    expect(balance.outgoingCents).toBe(10000);
    expect(balance.currentBalanceCents).toBe(125000);
  });
});

describe('B8 (DEC-212) — createIncomeTransaction factory', () => {
  it('builds a non-spending, non-learning income record', () => {
    const tx = createIncomeTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: 'w1',
      amountCents: 20000,
      currency: 'EUR',
      description: 'Reimbursement',
    });
    expect(tx.type).toBe('income');
    expect(tx.excludeFromLearning).toBe(true);
    expect(tx.personalCostCents).toBeNull();
    expect(tx.category).toBeNull();
    expect(tx.baseCurrencyAmountCents).toBe(20000);
    expect(tx.budgetPoolId).toBe('pool-1');
    expect(tx.walletId).toBe('w1');
    // Income must never be counted as spend, but must count as pool income.
    expect(calculatePoolSpent([tx])).toBe(0);
    expect(calculatePoolIncome([tx])).toBe(20000);
  });

  it('defaults the base-currency amount to the nominal amount', () => {
    const tx = createIncomeTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 12345,
      currency: 'EUR',
      description: 'Cash gift',
    });
    expect(tx.baseCurrencyAmountCents).toBe(12345);
    expect(tx.walletId).toBeNull();
  });
});
