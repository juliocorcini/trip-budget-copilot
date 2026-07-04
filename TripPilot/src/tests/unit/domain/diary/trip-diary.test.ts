import { describe, it, expect } from 'vitest';
import {
  buildTripDiary,
  renderTripDiaryHtml,
  type TripDiaryLabels,
} from '@/domain/diary';
import type { Transaction } from '@/domain/types/transaction';

// DEC-460 — the diary is a pure chronological projection: days ascending,
// entries by creation order, day totals in base cents, places deduped in
// first-seen order, photos counted from the caller-provided map.

const baseMeta = {
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

interface TxOverrides {
  amountCents: number;
  date: string;
  createdAt?: string;
  description?: string;
  category?: string | null;
  placeLabel?: string | null;
  notes?: string | null;
  personalCostCents?: number | null;
  baseCurrencyAmountCents?: number;
  type?: Transaction['type'];
  deletedAt?: string | null;
}

const mkTx = (id: string, o: TxOverrides): Transaction => ({
  ...baseMeta,
  createdAt: o.createdAt ?? baseMeta.createdAt,
  deletedAt: o.deletedAt ?? null,
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: 'w1',
  sessionId: null,
  type: o.type ?? 'expense',
  amountCents: o.amountCents,
  personalCostCents: o.personalCostCents === undefined ? o.amountCents : o.personalCostCents,
  currency: 'EUR',
  baseCurrencyAmountCents: o.baseCurrencyAmountCents ?? o.amountCents,
  exchangeRate: null,
  category: o.category === undefined ? 'food' : o.category,
  subcategoryId: null,
  placeLabel: o.placeLabel ?? null,
  latitude: null,
  longitude: null,
  placeId: null,
  description: o.description ?? 'test expense',
  date: o.date,
  isShared: false,
  paidByParticipantId: null,
  activityProfileId: null,
  isSpecialOccasion: false,
  excludeFromLearning: false,
  sourceWalletId: null,
  targetWalletId: null,
  settlementId: null,
  adjustmentReason: null,
  notes: o.notes ?? null,
});

const TRIP = {
  name: 'Euro Trip',
  baseCurrency: 'EUR',
  startDate: '2026-07-01',
  endDate: '2026-07-10',
};

describe('buildTripDiary (DEC-460)', () => {
  it('groups expenses by day, chronologically ascending, with per-day totals', () => {
    const diary = buildTripDiary({
      trip: TRIP,
      transactions: [
        mkTx('b', { amountCents: 2000, date: '2026-07-03' }),
        mkTx('a', { amountCents: 1500, date: '2026-07-01' }),
        mkTx('c', { amountCents: 500, date: '2026-07-03' }),
      ],
    });
    expect(diary.days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-03']);
    expect(diary.days[1]!.totalCents).toBe(2500);
    expect(diary.totalSpentCents).toBe(4000);
    expect(diary.expenseCount).toBe(3);
  });

  it('orders entries inside a day by creation time', () => {
    const diary = buildTripDiary({
      trip: TRIP,
      transactions: [
        mkTx('late', { amountCents: 100, date: '2026-07-02', createdAt: '2026-07-02T21:00:00.000Z' }),
        mkTx('early', { amountCents: 200, date: '2026-07-02', createdAt: '2026-07-02T08:00:00.000Z' }),
      ],
    });
    expect(diary.days[0]!.entries.map((e) => e.id)).toEqual(['early', 'late']);
  });

  it('ignores deleted and non-expense transactions', () => {
    const diary = buildTripDiary({
      trip: TRIP,
      transactions: [
        mkTx('keep', { amountCents: 1000, date: '2026-07-01' }),
        mkTx('gone', { amountCents: 9999, date: '2026-07-01', deletedAt: '2026-07-02T00:00:00.000Z' }),
        mkTx('income', { amountCents: 5000, date: '2026-07-01', type: 'income' }),
      ],
    });
    expect(diary.expenseCount).toBe(1);
    expect(diary.totalSpentCents).toBe(1000);
  });

  it('uses the base-currency personal cost (shared expense → own share only)', () => {
    const diary = buildTripDiary({
      trip: TRIP,
      transactions: [
        // Paid 300 for the table, own share 100 — the diary tells MY trip.
        mkTx('shared', {
          amountCents: 30000,
          personalCostCents: 10000,
          baseCurrencyAmountCents: 30000,
          date: '2026-07-01',
        }),
      ],
    });
    expect(diary.totalSpentCents).toBe(10000);
  });

  it('dedupes places in first-seen order and counts photos per day', () => {
    const diary = buildTripDiary({
      trip: TRIP,
      transactions: [
        mkTx('t1', { amountCents: 100, date: '2026-07-01', placeLabel: 'Café Central', createdAt: '2026-07-01T08:00:00.000Z' }),
        mkTx('t2', { amountCents: 200, date: '2026-07-01', placeLabel: 'Mercado', createdAt: '2026-07-01T12:00:00.000Z' }),
        mkTx('t3', { amountCents: 300, date: '2026-07-01', placeLabel: 'Café Central', createdAt: '2026-07-01T18:00:00.000Z' }),
      ],
      photoCountByTransactionId: new Map([
        ['t1', 2],
        ['t3', 1],
      ]),
    });
    expect(diary.days[0]!.places).toEqual(['Café Central', 'Mercado']);
    expect(diary.days[0]!.photoCount).toBe(3);
    expect(diary.placeCount).toBe(2);
    expect(diary.photoCount).toBe(3);
  });
});

const LABELS: TripDiaryLabels = {
  documentTitle: 'Trip diary',
  days: 'Days',
  expenses: 'Expenses',
  totalSpent: 'Total',
  places: 'Places',
  dayTotal: 'Day total',
  noEntries: 'Nothing yet',
  madeWith: 'Made with TripPilot',
};

describe('renderTripDiaryHtml (DEC-460)', () => {
  const diary = buildTripDiary({
    trip: TRIP,
    transactions: [
      mkTx('t1', {
        amountCents: 1250,
        date: '2026-07-01',
        description: 'Croissant & <espresso>',
        placeLabel: 'Café "Central"',
        notes: 'best morning',
      }),
    ],
    photoCountByTransactionId: new Map([['t1', 1]]),
  });
  const options = {
    labels: LABELS,
    dayHeading: (date: string) => `Day ${date}`,
    categoryName: () => 'Food',
    photosByEntry: { t1: ['data:image/jpeg;base64,AAAA'] },
  };

  it('produces a self-contained document with escaped user content and embedded photos', () => {
    const html = renderTripDiaryHtml(diary, options);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Croissant &amp; &lt;espresso&gt;');
    expect(html).toContain('Café &quot;Central&quot;');
    expect(html).toContain('data:image/jpeg;base64,AAAA');
    expect(html).toContain('Day 2026-07-01');
    expect(html).toContain('Made with TripPilot');
    // Self-contained: no external stylesheet/script references.
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="http');
  });

  it('renders the empty state when there are no days', () => {
    const empty = buildTripDiary({ trip: TRIP, transactions: [] });
    const html = renderTripDiaryHtml(empty, { ...options, photosByEntry: {} });
    expect(html).toContain('Nothing yet');
  });
});
