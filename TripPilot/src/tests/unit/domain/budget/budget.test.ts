import { describe, it, expect } from 'vitest';
import {
  calculateFreeToSpend,
  calculatePoolSpent,
  calculateFutureFloor,
  createPoolSummary,
  getBudgetHealthStatus,
} from '@/domain/budget';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
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

const mkTx = (id: string, amount: number, type: 'expense' | 'adjustment' = 'expense'): Transaction => ({
  ...baseMeta,
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: null,
  sessionId: null,
  type,
  amountCents: amount,
  personalCostCents: amount,
  currency: 'EUR',
  baseCurrencyAmountCents: amount,
  exchangeRate: null,
  category: 'bar',
  description: 'test',
  date: '2026-01-01T00:00:00.000Z',
  isShared: false,
  paidByParticipantId: null,
  activityProfileId: null,
  isSpecialOccasion: false,
  excludeFromLearning: false,
  sourceWalletId: null,
  targetWalletId: null,
  settlementId: null,
  adjustmentReason: null,
  notes: null,
});

describe('calculatePoolSpent', () => {
  it('sums expense and adjustment transactions', () => {
    const txs = [mkTx('t1', 5000), mkTx('t2', 3200)];
    expect(calculatePoolSpent(txs)).toBe(8200);
  });

  it('ignores deleted transactions', () => {
    const txs = [
      mkTx('t1', 5000),
      { ...mkTx('t2', 3200), deletedAt: '2026-01-02T00:00:00.000Z' },
    ];
    expect(calculatePoolSpent(txs)).toBe(5000);
  });

  it('ignores transfer transactions', () => {
    const txs = [
      mkTx('t1', 5000),
      { ...mkTx('t2', 3200), type: 'transfer' as const },
    ];
    expect(calculatePoolSpent(txs)).toBe(5000);
  });
});

describe('calculateFreeToSpend', () => {
  it('returns correct hero number', () => {
    const envelopes: Envelope[] = [
      { ...baseMeta, id: 'e1', budgetPoolId: 'pool-1', kind: 'protected_reserve', name: 'Reserve', amountCents: 15000, notes: null },
    ];
    const txs = [mkTx('t1', 25000), mkTx('t2', 18250)];
    const links: BudgetPoolPhaseLink[] = [
      { ...baseMeta, id: 'l1', budgetPoolId: 'pool-1', phaseId: 'phase-1', futureFloorCents: null },
      { ...baseMeta, id: 'l2', budgetPoolId: 'pool-1', phaseId: 'phase-2', futureFloorCents: 20000 },
    ];

    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1');
    // 150000 - 43250 - 15000 - 20000 = 71750
    expect(result.freeToSpendCents).toBe(71750);
    expect(result.totalBudgetCents).toBe(150000);
    expect(result.totalSpentCents).toBe(43250);
    expect(result.protectedReserveCents).toBe(15000);
    expect(result.futureFloorCents).toBe(20000);
  });

  it('never returns negative free-to-spend', () => {
    const envelopes: Envelope[] = [];
    const txs = [mkTx('t1', 200000)];
    const links: BudgetPoolPhaseLink[] = [];

    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1');
    expect(result.freeToSpendCents).toBe(0);
  });
});

describe('calculateFutureFloor', () => {
  it('sums floors from other phases', () => {
    const links: BudgetPoolPhaseLink[] = [
      { ...baseMeta, id: 'l1', budgetPoolId: 'pool-1', phaseId: 'phase-1', futureFloorCents: 10000 },
      { ...baseMeta, id: 'l2', budgetPoolId: 'pool-1', phaseId: 'phase-2', futureFloorCents: 20000 },
      { ...baseMeta, id: 'l3', budgetPoolId: 'pool-1', phaseId: 'phase-3', futureFloorCents: 5000 },
    ];
    expect(calculateFutureFloor(links, 'phase-1')).toBe(25000);
  });
});

describe('createPoolSummary', () => {
  it('creates summary with correct percentages', () => {
    const txs = [mkTx('t1', 75000)];
    const summary = createPoolSummary(pool, txs);
    expect(summary.spentCents).toBe(75000);
    expect(summary.remainingCents).toBe(75000);
    expect(summary.percentUsed).toBe(50);
  });
});

describe('getBudgetHealthStatus', () => {
  it('returns correct status', () => {
    expect(getBudgetHealthStatus(50)).toBe('healthy');
    expect(getBudgetHealthStatus(75)).toBe('warning');
    expect(getBudgetHealthStatus(95)).toBe('critical');
  });
});
