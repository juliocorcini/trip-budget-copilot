import { describe, it, expect } from 'vitest';
import { buildOccasionCounters } from '@/domain/dashboard';
import type { OccasionForecast } from '@/domain/forecasting';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Transaction } from '@/domain/types/transaction';

// U6 (DEC-180): unified occasion counters — planned metas first (remaining /
// done), then per-category item counts for everything else.

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    ...meta,
    id: `tx-${Math.random()}`,
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents: 1000,
    personalCostCents: 1000,
    currency: 'EUR',
    baseCurrencyAmountCents: 1000,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'test',
    date: '2026-06-10T12:00:00.000Z',
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
    ...overrides,
  } as Transaction;
}

function makeProfile(id: string, category: string, name = id): ActivityProfile {
  return { id, name, category, iconName: null } as unknown as ActivityProfile;
}

function makeForecast(
  profileId: string,
  totalPlanned: number,
  spent: number,
  profileName = profileId,
): OccasionForecast {
  return {
    profileId,
    profileName,
    totalPlanned,
    spent,
    remaining: Math.max(0, totalPlanned - spent),
    estimatedRemainingCostCents: 0,
  };
}

describe('buildOccasionCounters', () => {
  it('puts planned metas (with remaining/done) before activity counts', () => {
    const profiles = [makeProfile('bar', 'bar', 'Bar nights')];
    const forecasts = [makeForecast('bar', 5, 1, 'Bar nights')];
    const transactions = [
      makeTx({ category: 'transport' }),
      makeTx({ category: 'transport' }),
      makeTx({ category: 'attraction' }),
    ];

    const result = buildOccasionCounters({ forecasts, profiles, transactions });

    expect(result[0]).toMatchObject({
      kind: 'planned',
      profileId: 'bar',
      remaining: 4,
      done: 1,
    });
    // Activity counters follow, sorted by item count descending.
    expect(result.slice(1)).toEqual([
      { kind: 'activity', key: 'category:transport', category: 'transport', itemCount: 2 },
      { kind: 'activity', key: 'category:attraction', category: 'attraction', itemCount: 1 },
    ]);
  });

  it('keeps planned metas first even when an activity category dwarfs them in count (Julio device test 2026-06-18)', () => {
    // Burgos backup: bar/restaurant/market are planned (small remaining), while a
    // generic "other" pile has 43 raw items. The colour-coded metas must still
    // lead — count never promotes an unplanned category above an intention.
    const profiles = [
      makeProfile('bar', 'bar', 'Bar'),
      makeProfile('rest', 'restaurant', 'Restaurante'),
      makeProfile('mkt', 'market', 'Mercado'),
    ];
    const forecasts = [
      makeForecast('bar', 7, 5, 'Bar'),
      makeForecast('rest', 4, 0, 'Restaurante'),
      makeForecast('mkt', 3, 0, 'Mercado'),
    ];
    const transactions = [
      ...Array.from({ length: 43 }, () => makeTx({ category: 'other' })),
      ...Array.from({ length: 4 }, () => makeTx({ category: 'transport' })),
      ...Array.from({ length: 2 }, () => makeTx({ category: 'attraction' })),
    ];

    const result = buildOccasionCounters({ forecasts, profiles, transactions });

    expect(result.map((c) => c.kind)).toEqual([
      'planned',
      'planned',
      'planned',
      'activity',
      'activity',
      'activity',
    ]);
    // The three planned metas come first, in usage order (used before unused).
    expect(result.slice(0, 3).map((c) => c.category)).toEqual([
      'bar',
      'restaurant',
      'market',
    ]);
    // The 43-item "other" pile is an activity counter — never ahead of a meta.
    expect(result[3]).toMatchObject({ kind: 'activity', category: 'other', itemCount: 43 });
  });

  it('excludes a category already represented by a planned meta', () => {
    const profiles = [makeProfile('bar', 'bar', 'Bar nights')];
    const forecasts = [makeForecast('bar', 3, 0, 'Bar nights')];
    // Raw bar items exist, but the bar meta already speaks for the category.
    const transactions = [makeTx({ category: 'bar' }), makeTx({ category: 'bar' })];

    const result = buildOccasionCounters({ forecasts, profiles, transactions });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'planned', category: 'bar' });
  });

  it('treats a used-but-unplanned profile as activity, not a meta', () => {
    const profiles = [makeProfile('bar', 'bar', 'Bar nights')];
    // totalPlanned === 0 → not a meta; the bar category surfaces as item count.
    const forecasts = [makeForecast('bar', 0, 2, 'Bar nights')];
    const transactions = [makeTx({ category: 'bar' }), makeTx({ category: 'bar' })];

    const result = buildOccasionCounters({ forecasts, profiles, transactions });

    expect(result).toEqual([
      { kind: 'activity', key: 'category:bar', category: 'bar', itemCount: 2 },
    ]);
  });

  it('counts only non-deleted expenses (ignores transfers, adjustments, deleted)', () => {
    const transactions = [
      makeTx({ category: 'market' }),
      makeTx({ category: 'market', type: 'transfer' }),
      makeTx({ category: 'market', type: 'adjustment' }),
      makeTx({ category: 'market', deletedAt: '2026-06-11T00:00:00.000Z' }),
    ];

    const result = buildOccasionCounters({ forecasts: [], profiles: [], transactions });

    expect(result).toEqual([
      { kind: 'activity', key: 'category:market', category: 'market', itemCount: 1 },
    ]);
  });

  it('returns an empty list when there is nothing to show', () => {
    expect(buildOccasionCounters({ forecasts: [], profiles: [], transactions: [] })).toEqual([]);
  });
});
