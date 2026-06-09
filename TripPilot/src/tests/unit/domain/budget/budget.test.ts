import { describe, it, expect } from 'vitest';
import {
  calculateFreeToSpend,
  calculatePoolSpent,
  calculateFutureFloor,
  createPoolSummary,
  getBudgetHealthStatus,
  generateAmigoSinceroInsight,
  getAvailablePoolsForPhase,
  createEnvelope,
  createBudgetPoolPhaseLink,
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

  it('uses personal cost for shared expenses (financial flow vs personal cost)', () => {
    // €60 market split among 3 → financial flow 6000, personal cost 2000
    const sharedTx = { ...mkTx('t1', 6000), isShared: true, personalCostCents: 2000 };
    expect(calculatePoolSpent([sharedTx])).toBe(2000);
  });

  it('falls back to amount when personal cost is null', () => {
    const tx = { ...mkTx('t1', 5000), personalCostCents: null };
    expect(calculatePoolSpent([tx])).toBe(5000);
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

describe('generateAmigoSinceroInsight', () => {
  it('includes the profile category for type-specific messages', () => {
    // free €100, bar night €30: 3 before, recent spend €40 → 2 after
    const insight = generateAmigoSinceroInsight(
      10000,
      0,
      { typicalValueCents: 3000, category: 'bar' },
      4000,
    );
    expect(insight.hasInsight).toBe(true);
    expect(insight.beforeCount).toBe(3);
    expect(insight.afterCount).toBe(2);
    expect(insight.category).toBe('bar');
    expect(insight.reserveStatus).toBe('intact');
  });

  it('returns no insight without a profile', () => {
    const insight = generateAmigoSinceroInsight(10000, 0, null, 4000);
    expect(insight.hasInsight).toBe(false);
    expect(insight.category).toBe('other');
  });

  it('flags reserve as affected when spend exceeds free margin', () => {
    const insight = generateAmigoSinceroInsight(
      5000,
      2000,
      { typicalValueCents: 2500, category: 'market' },
      6000,
    );
    expect(insight.reserveStatus).toBe('affected');
    expect(insight.category).toBe('market');
  });
});

describe('getAvailablePoolsForPhase (DEC-039/040)', () => {
  const mkPool = (id: string, scope: 'linked_phases' | 'global'): BudgetPool => ({
    ...pool,
    id,
    scope,
  });
  const mkLink = (id: string, poolId: string, phaseId: string): BudgetPoolPhaseLink => ({
    ...baseMeta,
    id,
    budgetPoolId: poolId,
    phaseId,
    futureFloorCents: null,
  });

  it('filters operational pools by phase link and always includes globals', () => {
    const pools = [mkPool('p1', 'linked_phases'), mkPool('p2', 'linked_phases'), mkPool('pg', 'global')];
    const links = [mkLink('l1', 'p1', 'phase-1'), mkLink('l2', 'p2', 'phase-2')];

    const result = getAvailablePoolsForPhase(pools, links, 'phase-1');
    expect(result.operational.map((p) => p.id)).toEqual(['p1']);
    expect(result.global.map((p) => p.id)).toEqual(['pg']);
  });

  it('auto-selects only when there is exactly one operational pool', () => {
    const pools = [mkPool('p1', 'linked_phases'), mkPool('pg', 'global')];
    const links = [mkLink('l1', 'p1', 'phase-1')];

    expect(getAvailablePoolsForPhase(pools, links, 'phase-1').autoSelectedPoolId).toBe('p1');
    // global-only phases require a conscious choice
    expect(getAvailablePoolsForPhase(pools, links, 'phase-2').autoSelectedPoolId).toBeNull();
  });

  it('never auto-selects with two operational pools linked to the phase', () => {
    const pools = [mkPool('p1', 'linked_phases'), mkPool('p2', 'linked_phases')];
    const links = [mkLink('l1', 'p1', 'phase-1'), mkLink('l2', 'p2', 'phase-1')];

    const result = getAvailablePoolsForPhase(pools, links, 'phase-1');
    expect(result.operational).toHaveLength(2);
    expect(result.autoSelectedPoolId).toBeNull();
  });

  it('ignores soft-deleted links and pools', () => {
    const pools = [mkPool('p1', 'linked_phases'), { ...mkPool('p2', 'global'), deletedAt: '2026-01-02T00:00:00.000Z' }];
    const links = [{ ...mkLink('l1', 'p1', 'phase-1'), deletedAt: '2026-01-02T00:00:00.000Z' }];

    const result = getAvailablePoolsForPhase(pools, links, 'phase-1');
    expect(result.operational).toHaveLength(0);
    expect(result.global).toHaveLength(0);
  });
});

describe('createBudgetPoolPhaseLink with future floor (DEC-016)', () => {
  it('persists the manual future floor on the link', () => {
    const link = createBudgetPoolPhaseLink('pool-1', 'phase-2', 15000);
    expect(link.futureFloorCents).toBe(15000);
    expect(calculateFutureFloor([link], 'phase-1')).toBe(15000);
  });

  it('defaults to null floor', () => {
    expect(createBudgetPoolPhaseLink('pool-1', 'phase-2').futureFloorCents).toBeNull();
  });
});

describe('createEnvelope (DEC-042)', () => {
  it('creates an allocation envelope with sync metadata', () => {
    const envelope = createEnvelope({
      budgetPoolId: 'pool-1',
      kind: 'allocation',
      name: 'Presentes',
      amountCents: 8000,
    });
    expect(envelope.budgetPoolId).toBe('pool-1');
    expect(envelope.kind).toBe('allocation');
    expect(envelope.amountCents).toBe(8000);
    expect(envelope.deletedAt).toBeNull();
    expect(envelope.revision).toBe(1);
  });
});
