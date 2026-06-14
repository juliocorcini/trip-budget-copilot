import { describe, it, expect } from 'vitest';
import {
  buildTripReport,
  renderTripReportHtml,
  type TripReportLabels,
} from '@/domain/sharing';
import { formatMoney } from '@/domain/money';
import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPool } from '@/domain/types/budget-pool';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

interface TxOverrides {
  amountCents: number;
  category?: string | null;
  phaseId?: string;
  placeLabel?: string | null;
  sessionId?: string | null;
  exchangeRate?: number | null;
  baseCurrencyAmountCents?: number;
  type?: Transaction['type'];
  deletedAt?: string | null;
}

const mkTx = (id: string, o: TxOverrides): Transaction => ({
  ...baseMeta,
  deletedAt: o.deletedAt ?? null,
  id,
  tripId: 'trip-1',
  phaseId: o.phaseId ?? 'phase-1',
  budgetPoolId: 'pool-1',
  walletId: 'w1',
  sessionId: o.sessionId ?? null,
  type: o.type ?? 'expense',
  amountCents: o.amountCents,
  personalCostCents: o.amountCents,
  currency: 'EUR',
  baseCurrencyAmountCents: o.baseCurrencyAmountCents ?? o.amountCents,
  exchangeRate: o.exchangeRate ?? null,
  category: o.category === undefined ? 'food' : o.category,
  subcategoryId: null,
  placeLabel: o.placeLabel ?? null,
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

const POOLS: BudgetPool[] = [
  {
    ...baseMeta,
    id: 'pool-1',
    tripId: 'trip-1',
    name: 'Main',
    scope: 'global',
    currency: 'EUR',
    totalAmountCents: 10000,
    notes: null,
  },
];

const PHASES = [
  { id: 'phase-1', name: 'Lisbon' },
  { id: 'phase-2', name: 'Prague' },
];

const TRIP = { name: 'Euro Trip', baseCurrency: 'EUR', startDate: '2026-06-01', endDate: '2026-06-10' };

function sampleReport() {
  const transactions: Transaction[] = [
    mkTx('t1', { amountCents: 1000, category: 'food', phaseId: 'phase-1', placeLabel: 'Cafe', sessionId: 's1' }),
    mkTx('t2', { amountCents: 2000, category: 'bar', phaseId: 'phase-1', placeLabel: 'Cafe' }),
    // Foreign expense: 100000 CZK cents × 0.04 = 4000 EUR cents (base).
    mkTx('t3', { amountCents: 100000, category: 'food', phaseId: 'phase-2', placeLabel: 'Museum', exchangeRate: 0.04, baseCurrencyAmountCents: 4000 }),
    mkTx('t4', { amountCents: 9999, deletedAt: '2026-01-02T00:00:00.000Z' }), // deleted → ignored
    mkTx('t5', { amountCents: 5000, type: 'transfer' }), // non-expense → ignored
  ];
  const sessions = [{ id: 's1', deletedAt: null }];
  return buildTripReport({ trip: TRIP, transactions, pools: POOLS, phases: PHASES, sessions, generatedAt: '2026-06-10T12:30:00.000Z' });
}

describe('buildTripReport — base-currency aggregation (E6 / M18)', () => {
  const report = sampleReport();

  it('totals only active expenses in base currency (incl. foreign converted)', () => {
    // 1000 + 2000 + 4000 (foreign) = 7000; deleted/income excluded.
    expect(report.totalSpentCents).toBe(7000);
    expect(report.expenseCount).toBe(3);
    expect(report.totalBudgetCents).toBe(10000);
    expect(report.percentUsed).toBe(70);
  });

  it('groups categories in base, sorted by spend', () => {
    expect(report.byCategory).toEqual([
      { label: 'food', totalCents: 5000 }, // 1000 + 4000
      { label: 'bar', totalCents: 2000 },
    ]);
  });

  it('groups places in base, sorted by spend', () => {
    expect(report.byPlace).toEqual([
      { label: 'Museum', totalCents: 4000 },
      { label: 'Cafe', totalCents: 3000 },
    ]);
  });

  it('groups phases in chronological order, dropping empty ones', () => {
    expect(report.byPhase).toEqual([
      { label: 'Lisbon', totalCents: 3000 },
      { label: 'Prague', totalCents: 4000 },
    ]);
  });

  it('counts outings and their base total', () => {
    expect(report.outingCount).toBe(1);
    expect(report.outingTotalCents).toBe(1000); // only t1 carries session s1
  });
});

const LABELS: TripReportLabels = {
  documentTitle: 'Trip summary',
  generatedAt: 'Generated at',
  spent: 'Spent',
  budget: 'Budget',
  used: 'Used',
  expenses: 'Expenses',
  byPhase: 'By phase',
  byCategory: 'By category',
  byPlace: 'By place',
  outings: 'Outings',
  outingsSummary: '{{count}} outings · {{total}} total',
  noData: 'No data',
};

describe('renderTripReportHtml — self-contained offline document (M18)', () => {
  const report = sampleReport();

  it('produces a full HTML document with the right totals and labels', () => {
    const html = renderTripReportHtml(report, LABELS);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('Euro Trip');
    expect(html).toContain(formatMoney(7000, 'EUR'));
    expect(html).toContain(formatMoney(10000, 'EUR'));
    expect(html).toContain('70%');
    expect(html).toContain('food');
    expect(html).toContain('Museum');
    // Outing summary interpolation resolved.
    expect(html).toContain('1 outings');
  });

  it('is fully offline — no external network references', () => {
    const html = renderTripReportHtml(report, LABELS);
    expect(html).not.toContain('http');
    expect(html).not.toContain('<script');
  });

  it('escapes user-supplied text to prevent HTML injection', () => {
    const malicious = buildTripReport({
      trip: { ...TRIP, name: '<script>alert(1)</script>' },
      transactions: [],
      pools: POOLS,
      phases: PHASES,
      sessions: [],
      generatedAt: '2026-06-10T12:30:00.000Z',
    });
    const html = renderTripReportHtml(malicious, LABELS);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
