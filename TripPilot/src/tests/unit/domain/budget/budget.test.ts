import { describe, it, expect } from 'vitest';
import {
  calculateFreeToSpend,
  calculateEventReserves,
  calculatePoolSpent,
  calculateFutureFloor,
  createPoolSummary,
  getBudgetHealthStatus,
  getAvailablePoolsForPhase,
  resolvePoolPhaseId,
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
import type { PlannedPurchase } from '@/domain/types/planned-purchase';

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

    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1', [], []);
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

    const result = calculateFreeToSpend(pool, envelopes, txs, links, 'phase-1', [], []);
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
      occurrence({ id: 'o1' }), // active reserve → deducts (held)
      occurrence({ id: 'o2', isConfirmed: true }), // confirmed/resolved → reserves nothing
      occurrence({ id: 'o3', linkedSessionId: 's1' }), // DEC-385: session running but unspent → STILL held
      occurrence({ id: 'o4', phaseId: 'phase-2' }), // other phase → ignored
      occurrence({ id: 'o5', budgetPoolId: 'pool-2' }), // other pool → ignored here
      occurrence({ id: 'o6', reservedCents: null }), // no reserve → nothing to deduct
    ];

    // DEC-385 keystone: with no spend, both the plain reserve (o1) and the
    // just-started one (o3) are held — the phase "livre" does not jump on start.
    const result = calculateFreeToSpend(pool, [], [], [], 'phase-1', occurrences, []);
    expect(result.eventReservesCents).toBe(10000);
    expect(result.freeToSpendCents).toBe(150000 - 10000);
  });

  it('deducts the still-reserved total of open planned purchases (DEC-175)', () => {
    const purchase = (overrides: Partial<PlannedPurchase>): PlannedPurchase => ({
      ...baseMeta,
      id: 'pp-1',
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      name: 'Skincare',
      category: 'shopping',
      estimatedCostCents: 10000,
      reservedCents: 10000,
      status: 'planned',
      linkedTransactionIds: [],
      store: null,
      targetDate: null,
      notes: null,
      phaseId: null,
      ...overrides,
    });

    const purchases = [
      purchase({ id: 'pp-1', reservedCents: 10000 }), // open, full reserve → deducts 10000
      purchase({ id: 'pp-2', reservedCents: 5000, status: 'bought' }), // bought → deducts nothing
      purchase({ id: 'pp-3', reservedCents: 8000, budgetPoolId: 'pool-2' }), // other pool → ignored
      purchase({ id: 'pp-4', reservedCents: null }), // track-only → deducts nothing
    ];

    const result = calculateFreeToSpend(pool, [], [], [], 'phase-1', [], purchases);
    expect(result.plannedPurchasesCents).toBe(10000);
    expect(result.freeToSpendCents).toBe(150000 - 10000);
  });

  it('shrinks the planned-purchase reserve by real linked spend, no double counting (DEC-175)', () => {
    const linkedTx = mkTx('t1', 4000); // €40 already spent toward the plan
    const purchase: PlannedPurchase = {
      ...baseMeta,
      id: 'pp-1',
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      name: 'Creams',
      category: 'shopping',
      estimatedCostCents: 10000,
      reservedCents: 10000,
      status: 'planned',
      linkedTransactionIds: ['t1'],
      store: null,
      targetDate: null,
      notes: null,
      phaseId: null,
    };

    const result = calculateFreeToSpend(pool, [], [linkedTx], [], 'phase-1', [], [purchase]);
    // spent counts the 4000 once; reserve still holds 10000 - 4000 = 6000 → total impact 10000
    expect(result.totalSpentCents).toBe(4000);
    expect(result.plannedPurchasesCents).toBe(6000);
    expect(result.freeToSpendCents).toBe(150000 - 4000 - 6000);
  });
});

describe('calculateEventReserves (DEC-385 — consumable reserve, keystone)', () => {
  const occ = (overrides: Partial<PlannedOccurrence>): PlannedOccurrence => ({
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

  it('returns 0 when there are no active reserves', () => {
    expect(calculateEventReserves([], 'phase-1', [])).toBe(0);
  });

  it('holds the FULL reserve while nothing is spent — even after the outing starts', () => {
    // The keystone: the old code released the whole reserve once linkedSessionId
    // was set, making the phase "livre" jump. Now it stays held.
    expect(calculateEventReserves([occ({ linkedSessionId: 's1' })], 'phase-1', [])).toBe(5000);
  });

  it('shrinks the reserve by the spend attributed via occurrenceId', () => {
    const txs = [{ ...mkTx('t1', 2000), occurrenceId: 'o1' }];
    // remaining = max(0, 5000 − 2000) = 3000
    expect(calculateEventReserves([occ({ id: 'o1' })], 'phase-1', txs)).toBe(3000);
  });

  it("shrinks the reserve by the linked outing's spend (sessionId), never double counting", () => {
    const txs = [{ ...mkTx('t1', 1500), sessionId: 's1' }];
    expect(calculateEventReserves([occ({ id: 'o1', linkedSessionId: 's1' })], 'phase-1', txs)).toBe(
      3500,
    );
  });

  it('combines attributed + outing spend and never goes negative on overspend', () => {
    const txs = [
      { ...mkTx('t1', 4000), occurrenceId: 'o1' },
      { ...mkTx('t2', 3000), sessionId: 's1' },
    ];
    // consumed 7000 > reserved 5000 → remaining floored at 0
    expect(calculateEventReserves([occ({ id: 'o1', linkedSessionId: 's1' })], 'phase-1', txs)).toBe(
      0,
    );
  });

  it('a confirmed/resolved event and a track-only event reserve nothing', () => {
    const occurrences = [
      occ({ id: 'o1', isConfirmed: true }),
      occ({ id: 'o2', reservedCents: null }),
    ];
    expect(calculateEventReserves(occurrences, 'phase-1', [])).toBe(0);
  });

  it('ignores deleted occurrences and other phases', () => {
    const occurrences = [
      occ({ id: 'o1', deletedAt: '2026-06-13T00:00:00.000Z' }),
      occ({ id: 'o2', phaseId: 'phase-2' }),
    ];
    expect(calculateEventReserves(occurrences, 'phase-1', [])).toBe(0);
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
    expect(result.otherPhases).toHaveLength(0);
  });

  // E02 (DEC-322): off-phase funds are selectable, not hidden, not auto-selected.
  it('exposes a fund tied to another phase as otherPhases (selectable, not operational)', () => {
    const pools = [mkPool('p1', 'linked_phases'), mkPool('p2', 'linked_phases')];
    const links = [mkLink('l1', 'p1', 'phase-1'), mkLink('l2', 'p2', 'phase-2')];

    const result = getAvailablePoolsForPhase(pools, links, 'phase-1');
    expect(result.operational.map((p) => p.id)).toEqual(['p1']);
    expect(result.otherPhases.map((p) => p.id)).toEqual(['p2']); // the Eurotrip fund, from Burgos
    // never auto-selected from the off-phase group — only the lone operational pool is.
    expect(result.autoSelectedPoolId).toBe('p1');
  });

  it('keeps a legacy pool linked to many phases operational only (never duplicated in otherPhases)', () => {
    const pools = [mkPool('p1', 'linked_phases')];
    const links = [mkLink('l1', 'p1', 'phase-1'), mkLink('l2', 'p1', 'phase-2')];

    const result = getAvailablePoolsForPhase(pools, links, 'phase-1');
    expect(result.operational.map((p) => p.id)).toEqual(['p1']);
    expect(result.otherPhases).toHaveLength(0);
  });

  it('an off-phase fund does not become the auto-selection even with no operational pool', () => {
    const pools = [mkPool('p2', 'linked_phases')];
    const links = [mkLink('l2', 'p2', 'phase-2')];

    const result = getAvailablePoolsForPhase(pools, links, 'phase-1');
    expect(result.operational).toHaveLength(0);
    expect(result.otherPhases.map((p) => p.id)).toEqual(['p2']);
    expect(result.autoSelectedPoolId).toBeNull();
  });
});

describe('resolvePoolPhaseId (DEC-452 — the fund names its phase)', () => {
  const mkLink = (id: string, poolId: string, phaseId: string): BudgetPoolPhaseLink => ({
    ...baseMeta,
    id,
    budgetPoolId: poolId,
    phaseId,
    futureFloorCents: null,
  });

  it('a single live link resolves to that phase (the eurotrip fund)', () => {
    const links = [mkLink('l1', 'pool-eurotrip', 'phase-eurotrip'), mkLink('l2', 'pool-burgos', 'phase-burgos')];
    expect(resolvePoolPhaseId(links, 'pool-eurotrip')).toBe('phase-eurotrip');
    expect(resolvePoolPhaseId(links, 'pool-burgos')).toBe('phase-burgos');
  });

  it('a global pot (no links) resolves to null — the expense keeps its own phase', () => {
    expect(resolvePoolPhaseId([mkLink('l1', 'pool-1', 'phase-1')], 'pool-tomorrowland')).toBeNull();
  });

  it('a legacy pool shared across 2+ phases is ambiguous → null', () => {
    const links = [mkLink('l1', 'pool-1', 'phase-1'), mkLink('l2', 'pool-1', 'phase-2')];
    expect(resolvePoolPhaseId(links, 'pool-1')).toBeNull();
  });

  it('soft-deleted links do not count', () => {
    const links = [
      { ...mkLink('l1', 'pool-1', 'phase-1'), deletedAt: '2026-01-02T00:00:00.000Z' },
      mkLink('l2', 'pool-1', 'phase-2'),
    ];
    expect(resolvePoolPhaseId(links, 'pool-1')).toBe('phase-2');
  });

  it('no pool selected → null', () => {
    expect(resolvePoolPhaseId([mkLink('l1', 'pool-1', 'phase-1')], null)).toBeNull();
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
