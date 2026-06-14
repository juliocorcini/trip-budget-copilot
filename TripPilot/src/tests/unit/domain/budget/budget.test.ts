import { describe, it, expect } from 'vitest';
import {
  calculateFreeToSpend,
  calculateEventReserves,
  calculatePoolSpent,
  calculateFutureFloor,
  createPoolSummary,
  getBudgetHealthStatus,
  getAvailablePoolsForPhase,
  createEnvelope,
  createBudgetPoolPhaseLink,
  calculateLastOutingSavings,
  RECENT_OUTING_WINDOW_MS,
} from '@/domain/budget';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

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

    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1', []);
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

    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1', []);
    expect(result.freeToSpendCents).toBe(0);
  });

  it('deducts reserves of unconfirmed planned events in the phase (DEC-072)', () => {
    const occurrence = (overrides: Partial<PlannedOccurrence>): PlannedOccurrence => ({
      ...baseMeta,
      id: 'o1',
      tripId: 'trip-1',
      phaseId: 'phase-1',
      activityProfileId: null,
      budgetPoolId: 'pool-1',
      name: 'Parral',
      plannedDate: '2026-06-12',
      endDate: null,
      kind: 'event',
      estimatedCostCents: 5000,
      reservedCents: 5000,
      isConfirmed: false,
      linkedTransactionId: null,
      linkedSessionId: null,
      notes: null,
      ...overrides,
    });

    const occurrences = [
      occurrence({ id: 'o1' }), // active reserve → deducts
      occurrence({ id: 'o2', isConfirmed: true }), // confirmed → real spending takes over
      occurrence({ id: 'o3', linkedSessionId: 's1' }), // session running → stops deducting
      occurrence({ id: 'o4', phaseId: 'phase-2' }), // other phase → ignored
      occurrence({ id: 'o5', budgetPoolId: 'pool-2' }), // other pool → ignored here
      occurrence({ id: 'o6', reservedCents: null }), // no reserve → nothing to deduct
    ];

    const result = calculateFreeToSpend(pool, [], [], [], 'phase-1', occurrences);
    expect(result.eventReservesCents).toBe(5000);
    expect(result.freeToSpendCents).toBe(150000 - 5000);
  });
});

describe('calculateEventReserves', () => {
  it('returns 0 when there are no active reserves', () => {
    expect(calculateEventReserves([], 'phase-1')).toBe(0);
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

describe('calculateLastOutingSavings (DEC-092 / R-10)', () => {
  const NOW_MS = new Date('2026-06-10T22:00:00.000Z').getTime();
  const barProfile = { id: 'prof-bar', name: 'Bar', typicalValueCents: 300 };

  const mkSession = (id: string, endedAt: string | null, profileId: string | null = 'prof-bar') => ({
    id,
    name: 'Noite no bar',
    activityProfileId: profileId,
    endedAt,
  });

  const mkSessionTx = (id: string, sessionId: string, amount: number): Transaction => ({
    ...mkTx(id, amount),
    sessionId,
  });

  it('Julio scenario: spent €1 on a €3 typical bar night → saved €2 with reference', () => {
    const result = calculateLastOutingSavings(
      [mkSession('s1', '2026-06-10T01:00:00.000Z')],
      [mkSessionTx('t1', 's1', 100)],
      [barProfile],
      NOW_MS,
    );
    expect(result.hasSavings).toBe(true);
    expect(result.profileName).toBe('Bar');
    expect(result.spentCents).toBe(100);
    expect(result.savedCents).toBe(200);
    expect(result.typicalCents).toBe(300); // explicit reference value
  });

  it('uses the MOST RECENT closed outing, not an older cheaper one', () => {
    const result = calculateLastOutingSavings(
      [mkSession('old', '2026-06-08T01:00:00.000Z'), mkSession('new', '2026-06-10T01:00:00.000Z')],
      [mkSessionTx('t1', 'old', 50), mkSessionTx('t2', 'new', 250)],
      [barProfile],
      NOW_MS,
    );
    expect(result.spentCents).toBe(250);
    expect(result.savedCents).toBe(50);
  });

  it('no savings when the outing cost the typical value or more', () => {
    const result = calculateLastOutingSavings(
      [mkSession('s1', '2026-06-10T01:00:00.000Z')],
      [mkSessionTx('t1', 's1', 350)],
      [barProfile],
      NOW_MS,
    );
    expect(result.hasSavings).toBe(false);
  });

  it('stale outings (older than the recent window) do not show the card', () => {
    const staleEnd = new Date(NOW_MS - RECENT_OUTING_WINDOW_MS - 1).toISOString();
    const result = calculateLastOutingSavings(
      [mkSession('s1', staleEnd)],
      [mkSessionTx('t1', 's1', 100)],
      [barProfile],
      NOW_MS,
    );
    expect(result.hasSavings).toBe(false);
  });

  it('unreliable typical (0) or one-off sessions never produce the card', () => {
    const zeroTypical = calculateLastOutingSavings(
      [mkSession('s1', '2026-06-10T01:00:00.000Z')],
      [mkSessionTx('t1', 's1', 100)],
      [{ ...barProfile, typicalValueCents: 0 }],
      NOW_MS,
    );
    expect(zeroTypical.hasSavings).toBe(false);

    const oneOff = calculateLastOutingSavings(
      [mkSession('s1', '2026-06-10T01:00:00.000Z', null)],
      [mkSessionTx('t1', 's1', 100)],
      [barProfile],
      NOW_MS,
    );
    expect(oneOff.hasSavings).toBe(false);
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
