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
      // DEC-472: done is counted from the phase transactions (category ruler).
      makeTx({ category: 'bar' }),
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
    // Activity counters follow, sorted by occasion count descending.
    expect(result.slice(1)).toEqual([
      { kind: 'activity', key: 'category:transport', category: 'transport', occasionCount: 2 },
      { kind: 'activity', key: 'category:attraction', category: 'attraction', occasionCount: 1 },
    ]);
  });

  it('keeps planned metas first even when an activity category dwarfs them in count (Julio device test 2026-06-18)', () => {
    // Burgos backup: bar/restaurant/market are planned (small remaining), while a
    // generic "other" pile has 43 standalone quick-adds. The colour-coded metas
    // must still lead — count never promotes an unplanned category above an
    // intention. (43 SEPARATE expenses are genuinely 43 occasions — DEC-262 only
    // collapses many rows that share ONE session; see the receipt test below.)
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
    // The 43-occasion "other" pile is an activity counter — never ahead of a meta.
    expect(result[3]).toMatchObject({ kind: 'activity', category: 'other', occasionCount: 43 });
  });

  it('DEC-262/FB-14: a receipt (many rows under ONE sessionId) counts as a SINGLE occasion', () => {
    // The real complaint: a scanned receipt of 40 lines showed "40" in the
    // carousel. Those 40 rows all share the receipt's session → ONE occasion.
    // Two standalone "other" quick-adds add 2 more → 3 occasions total, not 42.
    const receipt = Array.from({ length: 40 }, () =>
      makeTx({ category: 'other', sessionId: 'receipt-sess-1' }),
    );
    const standalone = [makeTx({ category: 'other' }), makeTx({ category: 'other' })];

    const result = buildOccasionCounters({
      forecasts: [],
      profiles: [],
      transactions: [...receipt, ...standalone],
    });

    expect(result).toEqual([
      { kind: 'activity', key: 'category:other', category: 'other', occasionCount: 3 },
    ]);
  });

  it('DEC-262/FB-14: an outing session collapses to one occasion per category it touches', () => {
    // A bar outing wrote 5 drink rows (one session) + 1 snack row in a different
    // category of the same session → 1 occasion in "bar" and 1 in "snack".
    const outing = [
      ...Array.from({ length: 5 }, () => makeTx({ category: 'bar', sessionId: 'outing-1' })),
      makeTx({ category: 'snack', sessionId: 'outing-1' }),
    ];

    const result = buildOccasionCounters({ forecasts: [], profiles: [], transactions: outing });

    expect(result).toEqual([
      { kind: 'activity', key: 'category:bar', category: 'bar', occasionCount: 1 },
      { kind: 'activity', key: 'category:snack', category: 'snack', occasionCount: 1 },
    ]);
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
      { kind: 'activity', key: 'category:bar', category: 'bar', occasionCount: 2 },
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
      { kind: 'activity', key: 'category:market', category: 'market', occasionCount: 1 },
    ]);
  });

  it('returns an empty list when there is nothing to show', () => {
    expect(buildOccasionCounters({ forecasts: [], profiles: [], transactions: [] })).toEqual([]);
  });
});

// DEC-472 (field 2026-07-06) — the card's "done" is the WHOLE-PHASE total,
// measured with the SAME ruler as the list the tap opens. Julio's case: 17 bar
// spends in the phase, plan of 3 counting "from now" → the card read "3
// restantes · 0 feitas" while the tapped list showed 17 rows. Card == list.
describe('buildOccasionCounters — done = whole-phase total (DEC-472)', () => {
  const profiles = [makeProfile('bar-prof', 'bar', 'Bar')];
  // Forecast windowed by the plan cut: nothing consumed yet, 3 remaining.
  const forecasts = [makeForecast('bar-prof', 3, 0, 'Bar')];

  it("Julio's bar case: 17 phase spends read '17 feitas' even when the plan window says 0", () => {
    const transactions = Array.from({ length: 17 }, (_, i) =>
      makeTx({
        category: 'bar',
        date: `2026-06-${String(10 + i).padStart(2, '0')}T20:00:00.000Z`,
      }),
    );

    const result = buildOccasionCounters({ forecasts, profiles, transactions });

    // remaining keeps the plan window (3 left); done is the phase truth (17).
    expect(result[0]).toMatchObject({
      kind: 'planned',
      category: 'bar',
      remaining: 3,
      done: 17,
    });
    // The bar category is still swallowed by the meta — no duplicate counter.
    expect(result.filter((c) => c.category === 'bar')).toHaveLength(1);
  });

  it('done counts by CATEGORY (the tap filter) — profile-tagged and orphan spends together', () => {
    const transactions = [
      makeTx({ category: 'bar', activityProfileId: 'bar-prof' }),
      makeTx({ category: 'bar' }),
      // A bar spend tagged to another profile still shows in the category list.
      makeTx({ category: 'bar', activityProfileId: 'other-prof' }),
    ];

    const result = buildOccasionCounters({ forecasts, profiles, transactions });

    expect(result[0]).toMatchObject({ kind: 'planned', done: 3 });
  });

  it('collapses sessions into single occasions (DEC-262 semantics)', () => {
    const transactions = [
      ...Array.from({ length: 5 }, () =>
        makeTx({ category: 'bar', sessionId: 'outing-old', date: '2026-06-15T22:00:00.000Z' }),
      ),
      makeTx({ category: 'bar', date: '2026-06-20T22:00:00.000Z' }),
    ];

    const result = buildOccasionCounters({ forecasts, profiles, transactions });

    expect(result[0]).toMatchObject({ kind: 'planned', done: 2 });
  });

  it("custom 'other' profiles count by profile id — same ruler as their ?profile= tap filter", () => {
    const customProfiles = [makeProfile('spa-prof', 'other', 'Spa')];
    const customForecasts = [makeForecast('spa-prof', 3, 0, 'Spa')];
    const transactions = [
      // Unrelated generic quick-adds in 'other' — NOT spa activity.
      makeTx({ category: 'other', date: '2026-06-15T20:00:00.000Z' }),
      makeTx({ category: 'other', date: '2026-06-16T20:00:00.000Z' }),
      // A spend explicitly tagged with the profile → real spa activity.
      makeTx({
        category: 'other',
        activityProfileId: 'spa-prof',
        date: '2026-06-17T20:00:00.000Z',
      }),
    ];

    const result = buildOccasionCounters({
      forecasts: customForecasts,
      profiles: customProfiles,
      transactions,
    });

    expect(result[0]).toMatchObject({ kind: 'planned', done: 1 });
  });
});
