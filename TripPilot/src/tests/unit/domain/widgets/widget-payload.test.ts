import { describe, it, expect } from 'vitest';
import { buildWidgetPayload, daysUntil, categoryEmoji } from '@/domain/widgets';
import type { BuildWidgetPayloadInput } from '@/domain/widgets';
import { formatMoney } from '@/domain/money';
import type { Transaction } from '@/domain/types/transaction';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

// DEC-468 — the widget suite's single payload builder. Pure: raw model slices
// + localized label formatters in, the exact JSON contract the Android
// WidgetStore parses out.

const meta = {
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
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
    date: '2026-07-05T12:00:00.000Z',
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

function makeEvent(overrides: Partial<PlannedOccurrence>): PlannedOccurrence {
  return {
    ...meta,
    id: `occ-${Math.random()}`,
    tripId: 'trip-1',
    phaseId: 'ph-1',
    activityProfileId: null,
    budgetPoolId: 'pool-1',
    name: 'Tomorrowland',
    plannedDate: '2026-07-12',
    endDate: null,
    kind: 'event',
    estimatedCostCents: 15000,
    reservedCents: 15000,
    isConfirmed: false,
    linkedTransactionId: null,
    linkedSessionId: null,
    ...overrides,
  } as PlannedOccurrence;
}

const labels: BuildWidgetPayloadInput['labels'] = {
  freeToday: 'Livre hoje',
  addHint: '+',
  spentToday: (amount) => `Gasto hoje · ${amount}`,
  dayOf: (day, total) => `Dia ${day} de ${total}`,
  metas: 'Metas',
  metaDetailPlanned: (done, before) =>
    before > 0 ? `${done} feitas · ${before} antigas` : `${done} feitas`,
  metaDetailActivity: 'gastos',
  piggy: 'Cofrinho',
  piggyGoal: (amount) => `Meta: ${amount}`,
  nextEvent: 'Próximo evento',
  countdown: (days) => (days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`),
  eventReserve: (amount) => `${amount} reservados`,
  today: 'Hoje',
  rateStamp: 'câmbio de 04/07',
  actionAdd: 'Gasto',
  actionScan: 'Nota',
  actionOuting: 'Saída',
  actionConvert: 'Conversor',
  categoryName: (category) => `cat:${category}`,
};

function baseInput(overrides: Partial<BuildWidgetPayloadInput> = {}): BuildWidgetPayloadInput {
  return {
    baseCurrency: 'EUR',
    todayIso: '2026-07-05',
    freeToday: { freeTodayCents: 2350, todaySpentCents: 1200 },
    phase: { startDate: '2026-07-01', endDate: '2026-07-21' },
    occasionCounters: [],
    piggyBankCents: 0,
    savingsGoal: null,
    upcomingEvents: [],
    transactions: [],
    frozenRates: null,
    converterPair: { from: 'EUR', to: 'BRL', currencies: ['EUR', 'BRL', 'USD'] },
    labels,
    ...overrides,
  };
}

describe('daysUntil', () => {
  it('computes whole local days between two ISO days', () => {
    expect(daysUntil('2026-07-05', '2026-07-12')).toBe(7);
    expect(daysUntil('2026-07-05', '2026-07-05')).toBe(0);
    expect(daysUntil('2026-07-05', '2026-07-04')).toBe(-1);
  });
});

describe('buildWidgetPayload — freeToday', () => {
  it('formats the hero value, spent line and phase-day progress', () => {
    const payload = buildWidgetPayload(baseInput());
    expect(payload.freeToday).toEqual({
      value: formatMoney(2350, 'EUR'),
      label: 'Livre hoje',
      addHint: '+',
      spentLine: `Gasto hoje · ${formatMoney(1200, 'EUR')}`,
      // 2026-07-05 is day 5 of a 21-day phase (01..21).
      dayLine: 'Dia 5 de 21',
      progressPct: Math.round((5 / 21) * 100),
    });
  });

  it('omits the spent line when nothing was spent and survives a missing phase', () => {
    const payload = buildWidgetPayload(
      baseInput({ freeToday: { freeTodayCents: 500, todaySpentCents: 0 }, phase: null }),
    );
    expect(payload.freeToday).toMatchObject({ spentLine: null, dayLine: null, progressPct: null });
  });

  it('is null without a daily budget (widget shows its empty state)', () => {
    expect(buildWidgetPayload(baseInput({ freeToday: null })).freeToday).toBeNull();
  });
});

describe('buildWidgetPayload — metas', () => {
  it('maps planned counters (with pre-plan history) and activity counters, capped at 6', () => {
    const counters = [
      {
        kind: 'planned' as const,
        key: 'p1',
        profileId: 'p1',
        name: 'Bar',
        category: 'bar',
        remaining: 2,
        done: 0,
        beforePlanCount: 14,
      },
      {
        kind: 'activity' as const,
        key: 'category:transport',
        category: 'transport',
        occasionCount: 4,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        kind: 'activity' as const,
        key: `category:c${i}`,
        category: 'other',
        occasionCount: 1,
      })),
    ];
    const payload = buildWidgetPayload(baseInput({ occasionCounters: counters }));
    expect(payload.metas!.items).toHaveLength(6);
    expect(payload.metas!.items[0]).toEqual({
      emoji: '🍺',
      name: 'Bar',
      count: 2,
      detail: '0 feitas · 14 antigas',
    });
    expect(payload.metas!.items[1]).toEqual({
      emoji: '🚌',
      name: 'cat:transport',
      count: 4,
      detail: 'gastos',
    });
  });

  it('is null with no counters', () => {
    expect(buildWidgetPayload(baseInput()).metas).toBeNull();
  });
});

describe('buildWidgetPayload — piggy', () => {
  it('carries balance + goal progress', () => {
    const payload = buildWidgetPayload(
      baseInput({
        piggyBankCents: 4500,
        savingsGoal: { goalCents: 20000, progressRatio: 0.225 },
      }),
    );
    expect(payload.piggy).toEqual({
      label: 'Cofrinho',
      value: formatMoney(4500, 'EUR'),
      goalLine: `Meta: ${formatMoney(20000, 'EUR')}`,
      progressPct: 23,
    });
  });

  it('is null when the piggy is empty (nothing to brag about)', () => {
    expect(buildWidgetPayload(baseInput({ piggyBankCents: 0 })).piggy).toBeNull();
  });
});

describe('buildWidgetPayload — nextEvent', () => {
  it('picks the soonest dated event with countdown + absolute date + reserve', () => {
    const payload = buildWidgetPayload(
      baseInput({
        upcomingEvents: [
          makeEvent({ name: 'Far away', plannedDate: '2026-07-20' }),
          makeEvent({ name: 'Tomorrowland', plannedDate: '2026-07-12' }),
        ],
      }),
    );
    expect(payload.nextEvent).toEqual({
      label: 'Próximo evento',
      name: 'Tomorrowland',
      countdown: 'em 7 dias',
      daysUntil: 7,
      detailLine: `12/07 · ${formatMoney(15000, 'EUR')} reservados`,
    });
  });

  it('says "amanhã"/"hoje" at the edges', () => {
    const tomorrow = buildWidgetPayload(
      baseInput({ upcomingEvents: [makeEvent({ plannedDate: '2026-07-06' })] }),
    );
    expect(tomorrow.nextEvent!.countdown).toBe('amanhã');
    const today = buildWidgetPayload(
      baseInput({ upcomingEvents: [makeEvent({ plannedDate: '2026-07-05' })] }),
    );
    expect(today.nextEvent!.countdown).toBe('hoje');
  });

  it('is null with no dated upcoming events', () => {
    const payload = buildWidgetPayload(
      baseInput({ upcomingEvents: [makeEvent({ plannedDate: null })] }),
    );
    expect(payload.nextEvent).toBeNull();
  });
});

describe('buildWidgetPayload — today', () => {
  it("totals today's expenses and lists the newest first with category emoji", () => {
    const payload = buildWidgetPayload(
      baseInput({
        transactions: [
          makeTx({
            description: 'Cerveja',
            personalCostCents: 450,
            amountCents: 450,
            createdAt: '2026-07-05T20:00:00.000Z',
          }),
          makeTx({
            description: 'Almoço',
            category: 'restaurant',
            personalCostCents: 1800,
            amountCents: 1800,
            createdAt: '2026-07-05T13:00:00.000Z',
          }),
          // Not today → excluded from the widget.
          makeTx({ description: 'Ontem', date: '2026-07-04T12:00:00.000Z' }),
          // Deleted → excluded.
          makeTx({ description: 'Apagado', deletedAt: '2026-07-05T15:00:00.000Z' }),
        ],
      }),
    );
    expect(payload.today!.totalLine).toBe(formatMoney(2250, 'EUR'));
    expect(payload.today!.items.map((i) => i.text)).toEqual([
      `Cerveja · ${formatMoney(450, 'EUR')}`,
      `Almoço · ${formatMoney(1800, 'EUR')}`,
    ]);
    expect(payload.today!.items[1]!.emoji).toBe('🍽️');
  });

  it('is null when nothing was spent today', () => {
    expect(buildWidgetPayload(baseInput()).today).toBeNull();
  });
});

describe('buildWidgetPayload — converter', () => {
  it('carries the pair, cycle list and RAW rates for on-device conversion', () => {
    const payload = buildWidgetPayload(
      baseInput({
        frozenRates: {
          baseCurrency: 'EUR',
          fetchedAt: '2026-07-04T09:00:00.000Z',
          ratesToBase: { BRL: 0.157, USD: 0.85 },
        },
      }),
    );
    expect(payload.converter).toEqual({
      from: 'EUR',
      to: 'BRL',
      currencies: ['EUR', 'BRL', 'USD'],
      base: 'EUR',
      ratesToBase: { BRL: 0.157, USD: 0.85 },
      rateStamp: 'câmbio de 04/07',
    });
  });

  it('degrades to empty rates without a snapshot (widget shows "sem câmbio")', () => {
    const payload = buildWidgetPayload(baseInput());
    expect(payload.converter).toMatchObject({ base: 'EUR', ratesToBase: {} });
  });
});

describe('categoryEmoji', () => {
  it('maps known categories and falls back for unknown/null', () => {
    expect(categoryEmoji('bar')).toBe('🍺');
    expect(categoryEmoji('made-up')).toBe('💸');
    expect(categoryEmoji(null)).toBe('💸');
  });
});
