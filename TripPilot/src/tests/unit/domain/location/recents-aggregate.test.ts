import { describe, it, expect } from 'vitest';
import { deriveRecentPlaces, aggregateByPlace } from '@/domain/location';
import type { Transaction } from '@/domain/types/transaction';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

// Reference coordinates.
const LISBON = { lat: 38.7223, lng: -9.1393 };
const PORTO = { lat: 41.1579, lng: -8.6291 };

function mkTx(over: Partial<Transaction> = {}): Transaction {
  return {
    ...baseMeta,
    id: 'tx',
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: 'w1',
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
    description: 'x',
    date: '2026-01-01T12:00:00.000Z',
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
    ...over,
  };
}

describe('deriveRecentPlaces (M4)', () => {
  it('returns nothing when no expense carries a place', () => {
    expect(deriveRecentPlaces([mkTx(), mkTx({ id: 't2' })])).toEqual([]);
  });

  it('groups by label, counts uses, and keeps the most recent label', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Bar do Porto', date: '2026-01-02T10:00:00.000Z' }),
      mkTx({ id: 'a2', placeLabel: 'Bar do Porto', date: '2026-01-04T10:00:00.000Z' }),
    ];
    const recents = deriveRecentPlaces(txs);
    expect(recents).toHaveLength(1);
    expect(recents[0]!.count).toBe(2);
    expect(recents[0]!.label).toBe('Bar do Porto');
    expect(recents[0]!.lastUsedAt).toBe('2026-01-04T10:00:00.000Z');
  });

  it('keeps the freshest known coordinates even if a later entry has none', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Praça', date: '2026-01-02T10:00:00.000Z', latitude: PORTO.lat, longitude: PORTO.lng }),
      mkTx({ id: 'a2', placeLabel: 'Praça', date: '2026-01-05T10:00:00.000Z' }),
    ];
    const [recent] = deriveRecentPlaces(txs);
    expect(recent!.lat).toBe(PORTO.lat);
    expect(recent!.lng).toBe(PORTO.lng);
  });

  it('ignores deleted and non-expense transactions', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Kept', date: '2026-01-02T10:00:00.000Z' }),
      mkTx({ id: 'a2', placeLabel: 'Deleted', deletedAt: '2026-01-03T00:00:00.000Z' }),
      mkTx({ id: 'a3', placeLabel: 'Transfer', type: 'transfer' }),
    ];
    expect(deriveRecentPlaces(txs).map((p) => p.label)).toEqual(['Kept']);
  });

  it('orders by recency when no current position is given', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Older', date: '2026-01-02T10:00:00.000Z' }),
      mkTx({ id: 'a2', placeLabel: 'Newer', date: '2026-01-09T10:00:00.000Z' }),
    ];
    expect(deriveRecentPlaces(txs).map((p) => p.label)).toEqual(['Newer', 'Older']);
  });

  it('orders by proximity (nearest first) when the current position is known', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Porto', date: '2026-01-09T10:00:00.000Z', latitude: PORTO.lat, longitude: PORTO.lng }),
      mkTx({ id: 'a2', placeLabel: 'Lisbon', date: '2026-01-02T10:00:00.000Z', latitude: LISBON.lat, longitude: LISBON.lng }),
    ];
    // Current position right next to Lisbon → Lisbon should win despite Porto
    // being the most recent.
    const recents = deriveRecentPlaces(txs, { lat: 38.7224, lng: -9.1394 });
    expect(recents.map((p) => p.label)).toEqual(['Lisbon', 'Porto']);
    expect(recents[0]!.distanceMeters).toBeLessThan(100);
  });

  it('sorts coordinate-less (manual) places last when distances are known', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Manual', date: '2026-01-09T10:00:00.000Z' }),
      mkTx({ id: 'a2', placeLabel: 'Porto', date: '2026-01-02T10:00:00.000Z', latitude: PORTO.lat, longitude: PORTO.lng }),
    ];
    const recents = deriveRecentPlaces(txs, PORTO);
    expect(recents.map((p) => p.label)).toEqual(['Porto', 'Manual']);
    expect(recents[1]!.distanceMeters).toBeNull();
  });

  it('respects the limit', () => {
    const txs = Array.from({ length: 10 }, (_, i) =>
      mkTx({ id: `a${i}`, placeLabel: `Place ${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` }),
    );
    expect(deriveRecentPlaces(txs, null, 3)).toHaveLength(3);
  });
});

describe('aggregateByPlace (M7)', () => {
  it('sums spend per place and sorts by the highest total', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Bar', amountCents: 1500 }),
      mkTx({ id: 'a2', placeLabel: 'Bar', amountCents: 2500 }),
      mkTx({ id: 'a3', placeLabel: 'Café', amountCents: 3000 }),
    ];
    const totals = aggregateByPlace(txs);
    expect(totals).toHaveLength(2);
    // Bar = 4000 > Café = 3000.
    expect(totals[0]).toMatchObject({ label: 'Bar', totalCents: 4000, count: 2 });
    expect(totals[1]).toMatchObject({ label: 'Café', totalCents: 3000, count: 1 });
  });

  it('groups by provider place id when present', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Old name', placeId: 'osm-42', amountCents: 1000 }),
      mkTx({ id: 'a2', placeLabel: 'New name', placeId: 'osm-42', amountCents: 1000 }),
    ];
    const totals = aggregateByPlace(txs);
    expect(totals).toHaveLength(1);
    expect(totals[0]!.totalCents).toBe(2000);
    expect(totals[0]!.count).toBe(2);
  });

  it('ignores deleted, non-expense, and placeless rows', () => {
    const txs = [
      mkTx({ id: 'a1', placeLabel: 'Counted', amountCents: 500 }),
      mkTx({ id: 'a2', placeLabel: 'Gone', deletedAt: '2026-01-03T00:00:00.000Z', amountCents: 999 }),
      mkTx({ id: 'a3', placeLabel: null, amountCents: 999 }),
    ];
    const totals = aggregateByPlace(txs);
    expect(totals).toEqual([{ label: 'Counted', placeId: null, totalCents: 500, count: 1 }]);
  });
});
