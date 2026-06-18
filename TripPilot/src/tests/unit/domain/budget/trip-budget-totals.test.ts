import { describe, it, expect } from 'vitest';
import { computeTripBudgetTotals, summarizeTrechoBalance } from '@/domain/budget';
import type { BudgetPool } from '@/domain/types/budget-pool';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

const mkPool = (
  id: string,
  scope: BudgetPool['scope'],
  totalAmountCents: number,
  over: Partial<BudgetPool> = {},
): BudgetPool => ({
  ...baseMeta,
  id,
  tripId: 'trip-1',
  name: id,
  scope,
  totalAmountCents,
  currency: 'EUR',
  notes: null,
  ...over,
});

describe('computeTripBudgetTotals (GATE 2 M2.4 — D14: trip total = sum of trechos)', () => {
  it('sums trechos (linked_phases) and pots (global) separately — the canonical trip', () => {
    // Master §2: Burgos 628 + Eurotrip 678 + Volta 131 = 1.437 trip; Tomorrowland 200 apart.
    const pools = [
      mkPool('burgos', 'linked_phases', 62_800),
      mkPool('eurotrip', 'linked_phases', 67_800),
      mkPool('volta', 'linked_phases', 13_100),
      mkPool('tomorrowland', 'global', 20_000),
    ];
    expect(computeTripBudgetTotals(pools)).toEqual({
      trechosTotalCents: 143_700,
      potesTotalCents: 20_000,
    });
  });

  it('ignores soft-deleted pools', () => {
    const pools = [
      mkPool('a', 'linked_phases', 10_000),
      mkPool('gone', 'linked_phases', 99_900, { deletedAt: '2026-02-01T00:00:00.000Z' }),
      mkPool('pot-gone', 'global', 50_000, { deletedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(computeTripBudgetTotals(pools)).toEqual({
      trechosTotalCents: 10_000,
      potesTotalCents: 0,
    });
  });

  it('returns zeros for an empty trip', () => {
    expect(computeTripBudgetTotals([])).toEqual({ trechosTotalCents: 0, potesTotalCents: 0 });
  });
});

describe('summarizeTrechoBalance (GATE 2 M2.4 — "passou €X" overflow signal)', () => {
  it('reports the overflow as a positive amount when free-to-spend is negative', () => {
    expect(summarizeTrechoBalance(-4_250)).toEqual({ status: 'over', overflowCents: 4_250 });
  });
  it('is ok at exactly zero and when positive', () => {
    expect(summarizeTrechoBalance(0)).toEqual({ status: 'ok', overflowCents: 0 });
    expect(summarizeTrechoBalance(12_000)).toEqual({ status: 'ok', overflowCents: 0 });
  });
});
