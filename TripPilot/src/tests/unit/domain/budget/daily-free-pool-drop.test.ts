import { describe, it, expect } from 'vitest';
import { calculateDailyFreePoolDrop } from '@/domain/budget';
import { calculateSpentOnDate } from '@/domain/transactions';
import { createPlannedOccurrence, createPlannedPurchase } from '@/domain/planning';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Envelope } from '@/domain/types/envelope';
import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';

/**
 * DEC-411 (field fix 2026-06-29): the daily "livre do dia" must subtract how much
 * the FREE POOL actually dropped today — not the gross spend. A spend covered by
 * an event/planned CONSUMABLE reserve (DEC-385) already left the free pool when it
 * was set aside, so it must net to zero against the day; only the reserve OVERFLOW
 * and discretionary spend may reduce it. The reported bug: a Wise import attributed
 * to a live event drove the daily free negative even though the event reserve paid
 * for it. With no reserve in play the helper is byte-identical to the gross
 * `calculateSpentOnDate` it replaces (Â-MONEY-INVARIANT).
 */

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

const POOL_TOTAL = 100000;
const TODAY = '2026-06-12';
const YESTERDAY = '2026-06-11';

const pool: BudgetPool = {
  ...baseMeta,
  id: 'pool-1',
  tripId: 'trip-1',
  name: 'Main Fund',
  scope: 'linked_phases',
  totalAmountCents: POOL_TOTAL,
  currency: 'EUR',
  notes: null,
};

const links: BudgetPoolPhaseLink[] = [
  { ...baseMeta, id: 'l1', budgetPoolId: 'pool-1', phaseId: 'phase-1', futureFloorCents: null },
];

const noEnvelopes: Envelope[] = [];

interface TxOpts {
  date?: string;
  occurrenceId?: string | null;
  type?: 'expense' | 'adjustment';
}

function mkTx(id: string, amountCents: number, opts: TxOpts = {}): Transaction {
  return {
    ...baseMeta,
    id,
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    occurrenceId: opts.occurrenceId ?? null,
    type: opts.type ?? 'expense',
    amountCents,
    personalCostCents: amountCents,
    currency: 'EUR',
    baseCurrencyAmountCents: amountCents,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'test',
    date: `${opts.date ?? TODAY}T12:00:00.000Z`,
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
  };
}

function mkEvent(reservedCents: number | null, overrides: Partial<PlannedOccurrence> = {}): PlannedOccurrence {
  return {
    ...createPlannedOccurrence({
      tripId: 'trip-1',
      phaseId: 'phase-1',
      budgetPoolId: 'pool-1',
      name: 'Show',
      plannedDate: '2026-06-10',
      endDate: '2026-06-14',
      kind: 'event',
      estimatedCostCents: reservedCents ?? 0,
      reservedCents,
      activityProfileId: null,
    }),
    id: 'evt-1',
    ...overrides,
  };
}

const drop = (
  txs: Transaction[],
  occurrences: PlannedOccurrence[] = [],
  plannedPurchases: PlannedPurchase[] = [],
): number =>
  calculateDailyFreePoolDrop(
    pool,
    noEnvelopes,
    txs,
    links,
    'phase-1',
    occurrences,
    plannedPurchases,
    TODAY,
    [],
  );

describe('calculateDailyFreePoolDrop (DEC-411 · field fix)', () => {
  it('equals the gross daily spend when no reserve is in play (Â-MONEY-INVARIANT)', () => {
    const txs = [mkTx('t-today', 3000), mkTx('t-prev', 2000, { date: YESTERDAY })];
    // Only today's €30 affects the free pool; yesterday's €20 is not today's drop.
    expect(drop(txs)).toBe(3000);
    expect(drop(txs)).toBe(calculateSpentOnDate(txs, TODAY));
  });

  it('is ZERO for a spend fully covered by a live event reserve (the reported bug)', () => {
    // €50 reserved; a €14 import attributed to the event today.
    const event = mkEvent(5000);
    const txs = [mkTx('t-wise', 1400, { occurrenceId: 'evt-1' })];
    // Gross would have driven "livre do dia" down by €14 — the reserve already paid.
    expect(calculateSpentOnDate(txs, TODAY)).toBe(1400);
    expect(drop(txs, [event])).toBe(0);
  });

  it('drops only the OVERFLOW when today exceeds the remaining event reserve', () => {
    // €10 reserved; €14 attributed today → €4 spills past the reserve into free.
    const event = mkEvent(1000);
    const txs = [mkTx('t-wise', 1400, { occurrenceId: 'evt-1' })];
    expect(drop(txs, [event])).toBe(400);
  });

  it('drops only the discretionary part when an event spend and a free spend share the day', () => {
    const event = mkEvent(5000);
    const txs = [
      mkTx('t-evt', 1400, { occurrenceId: 'evt-1' }), // covered by reserve → nets 0
      mkTx('t-free', 3000), // discretionary → full drop
    ];
    expect(drop(txs, [event])).toBe(3000);
    // ...and it is strictly less than the gross spend of the day (€44).
    expect(calculateSpentOnDate(txs, TODAY)).toBe(4400);
  });

  it('is path-independent: a spend still within the reserve nets to zero even after earlier consumption', () => {
    // €50 reserved, €20 already consumed yesterday → €30 left; €14 today still fits.
    const event = mkEvent(5000);
    const txs = [
      mkTx('t-prev', 2000, { date: YESTERDAY, occurrenceId: 'evt-1' }),
      mkTx('t-today', 1400, { occurrenceId: 'evt-1' }),
    ];
    expect(drop(txs, [event])).toBe(0);
  });

  it('generalizes to planned-purchase reserves (spend within reserve does not move the day)', () => {
    const purchase: PlannedPurchase = {
      ...createPlannedPurchase({
        tripId: 'trip-1',
        budgetPoolId: 'pool-1',
        name: 'Sneakers',
        category: 'shopping',
        estimatedCostCents: 5000,
        reservedCents: 5000,
      }),
      id: 'pp-1',
      linkedTransactionIds: ['t-buy'],
    };
    const txs = [mkTx('t-buy', 1400)];
    expect(drop(txs, [], [purchase])).toBe(0);
  });

  it('is NOT clamped: a refund/negative adjustment day matches the gross (negative) spend', () => {
    const txs = [mkTx('t-refund', -1000, { type: 'adjustment' })];
    expect(calculateSpentOnDate(txs, TODAY)).toBe(-1000);
    expect(drop(txs)).toBe(-1000);
  });

  it('ignores spend dated on other days (only today shifts the free pool)', () => {
    const txs = [mkTx('t-prev', 5000, { date: YESTERDAY })];
    expect(drop(txs)).toBe(0);
  });
});
