import { describe, it, expect } from 'vitest';
import { buildPhaseAllowanceMap, calculateTodayFreeBudget } from '@/domain/phases';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Phase, PhaseRhythmPreset } from '@/domain/types/phase';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { Transaction } from '@/domain/types/transaction';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function mkPhase(rhythmPreset: PhaseRhythmPreset | null, peakDays: number[] | null): Phase {
  return {
    ...meta,
    id: 'ph-1',
    tripId: 'trip-1',
    name: 'Barcelona',
    // 2026-06-08 is a Monday; 2026-06-14 is a Sunday.
    startDate: '2026-06-08',
    endDate: '2026-06-14',
    order: 0,
    rhythmPreset,
    peakDays,
    notes: null,
  };
}

function mkOccurrence(over: Partial<PlannedOccurrence>): PlannedOccurrence {
  return {
    ...meta,
    id: 'occ-1',
    tripId: 'trip-1',
    phaseId: 'ph-1',
    activityProfileId: null,
    budgetPoolId: 'pool-1',
    name: 'Show',
    plannedDate: null,
    endDate: null,
    kind: 'event',
    estimatedCostCents: 0,
    reservedCents: null,
    isConfirmed: false,
    linkedTransactionId: null,
    linkedSessionId: null,
    notes: null,
    ...over,
  };
}

function mkPurchase(over: Partial<PlannedPurchase>): PlannedPurchase {
  return {
    ...meta,
    id: 'pp-1',
    tripId: 'trip-1',
    budgetPoolId: 'pool-1',
    name: 'Face cream',
    category: 'shopping',
    estimatedCostCents: 0,
    reservedCents: null,
    status: 'planned',
    linkedTransactionIds: [],
    store: null,
    targetDate: null,
    notes: null,
    phaseId: 'ph-1',
    ...over,
  };
}

describe('buildPhaseAllowanceMap (FIELD-19 — per-day allowance map)', () => {
  it('uniform phase splits the base evenly across remaining days', () => {
    const phase = mkPhase(null, null);
    // From Thu 2026-06-11 to Sun 2026-06-14 = 4 days.
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [],
      plannedPurchases: [],
    });

    expect(map.days).toHaveLength(4);
    expect(map.baseFreeCents).toBe(40_000);
    map.days.forEach((d) => {
      expect(d.allowanceCents).toBe(10_000);
      expect(d.freeCents).toBe(10_000);
    });
    expect(map.days[0]?.isToday).toBe(true);
    expect(map.days[1]?.isToday).toBe(false);
  });

  it("today's allowance and free match calculateTodayFreeBudget exactly", () => {
    const phase = mkPhase('moderate', [5, 6]); // Fri/Sat peak
    const trueFreeCents = 52_300;
    const todaySpentCents = 1_840;
    const todayIso = '2026-06-11'; // Thursday (weekday)

    const map = buildPhaseAllowanceMap({
      trueFreeCents,
      todaySpentCents,
      phase,
      todayIso,
      occurrences: [],
      plannedPurchases: [],
    });
    const today = calculateTodayFreeBudget(trueFreeCents, todaySpentCents, phase, todayIso);

    expect(map.days[0]?.isToday).toBe(true);
    expect(map.days[0]?.allowanceCents).toBe(today.todayAllowanceCents);
    expect(map.days[0]?.freeCents).toBe(today.freeTodayCents);
    expect(map.days[0]?.spentCents).toBe(todaySpentCents);
  });

  it('peak days get a larger allowance than weekdays', () => {
    const phase = mkPhase('moderate', [5, 6]); // Fri(5)/Sat(6) peak
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 70_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11', // Thursday
      occurrences: [],
      plannedPurchases: [],
    });

    const saturday = map.days.find((d) => d.dateIso === '2026-06-13');
    const thursday = map.days.find((d) => d.dateIso === '2026-06-11');
    expect(saturday?.isPeakDay).toBe(true);
    expect(thursday?.isPeakDay).toBe(false);
    expect((saturday?.allowanceCents ?? 0)).toBeGreaterThan(thursday?.allowanceCents ?? 0);
    // maxAllowance should equal the biggest single-day allowance (a peak day).
    expect(map.maxAllowanceCents).toBe(saturday?.allowanceCents);
  });

  it('places dated reserves (event + dated purchase) on their day', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [
        mkOccurrence({ id: 'occ-sat', name: 'Rooftop party', plannedDate: '2026-06-13', reservedCents: 6_000 }),
      ],
      plannedPurchases: [
        mkPurchase({ id: 'pp-sat', name: 'Face cream', targetDate: '2026-06-13', reservedCents: 5_000 }),
      ],
    });

    const saturday = map.days.find((d) => d.dateIso === '2026-06-13');
    expect(saturday?.planItems).toHaveLength(2);
    expect(saturday?.planTotalCents).toBe(11_000);
    expect(saturday?.planItems.map((i) => i.kind).sort()).toEqual(['occurrence', 'purchase']);
  });

  it('lists undated trip-wide planned purchases separately', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [],
      plannedPurchases: [
        mkPurchase({ id: 'pp-undated', name: 'Clothes', targetDate: null, reservedCents: 8_000 }),
      ],
    });

    expect(map.undatedPlanItems).toHaveLength(1);
    expect(map.undatedPlanTotalCents).toBe(8_000);
    // Undated items never leak into a day's planItems.
    map.days.forEach((d) => expect(d.planItems).toHaveLength(0));
  });

  it('ignores bought/cancelled purchases and already-linked occurrences', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [
        mkOccurrence({ id: 'occ-done', plannedDate: '2026-06-12', reservedCents: 5_000, linkedTransactionId: 'tx-1' }),
      ],
      plannedPurchases: [
        mkPurchase({ id: 'pp-bought', targetDate: '2026-06-12', reservedCents: 5_000, status: 'bought' }),
        mkPurchase({ id: 'pp-cancelled', targetDate: null, reservedCents: 5_000, status: 'cancelled' }),
      ],
    });

    map.days.forEach((d) => expect(d.planItems).toHaveLength(0));
    expect(map.undatedPlanItems).toHaveLength(0);
  });

  it('returns no days once the phase has ended', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-20', // after endDate 2026-06-14
      occurrences: [],
      plannedPurchases: [],
    });
    expect(map.days).toHaveLength(0);
  });

  it('uses estimatedCost when no explicit reserve is set', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [],
      plannedPurchases: [
        mkPurchase({ id: 'pp-est', targetDate: '2026-06-12', reservedCents: null, estimatedCostCents: 3_300 }),
      ],
    });
    const friday = map.days.find((d) => d.dateIso === '2026-06-12');
    expect(friday?.planTotalCents).toBe(3_300);
  });
});

describe('buildPhaseAllowanceMap — multi-day event reserve spread (Julio field)', () => {
  it('spreads a multi-day event reserve evenly across its days (€100 / 26→30 = €20/day)', () => {
    const phase = mkPhase(null, null); // 2026-06-08 → 2026-06-14
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-08',
      occurrences: [
        mkOccurrence({
          id: 'occ-multi',
          name: 'Festival',
          plannedDate: '2026-06-10',
          endDate: '2026-06-14', // 5 days
          reservedCents: 10_000,
        }),
      ],
      plannedPurchases: [],
    });

    const eventDays = map.days.filter((d) => d.dateIso >= '2026-06-10' && d.dateIso <= '2026-06-14');
    expect(eventDays).toHaveLength(5);
    eventDays.forEach((d) => {
      expect(d.planTotalCents).toBe(2_000); // 10_000 / 5
      expect(d.planItems).toHaveLength(1);
      expect(d.planItems[0]?.name).toBe('Festival');
    });
    // Days before the event carry no share of its reserve.
    const before = map.days.find((d) => d.dateIso === '2026-06-09');
    expect(before?.planTotalCents).toBe(0);
    // The spread sums back to the exact reserve (no cents lost).
    const total = eventDays.reduce((acc, d) => acc + d.planTotalCents, 0);
    expect(total).toBe(10_000);
  });

  it('rides the rounding remainder on the last day so parts sum to the reserve', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-08',
      occurrences: [
        mkOccurrence({
          id: 'occ-odd',
          plannedDate: '2026-06-10',
          endDate: '2026-06-12', // 3 days
          reservedCents: 10_000, // 3_333 + 3_333 + 3_334
        }),
      ],
      plannedPurchases: [],
    });

    const d10 = map.days.find((d) => d.dateIso === '2026-06-10');
    const d11 = map.days.find((d) => d.dateIso === '2026-06-11');
    const d12 = map.days.find((d) => d.dateIso === '2026-06-12');
    expect(d10?.planTotalCents).toBe(3_333);
    expect(d11?.planTotalCents).toBe(3_333);
    expect(d12?.planTotalCents).toBe(3_334);
    expect((d10?.planTotalCents ?? 0) + (d11?.planTotalCents ?? 0) + (d12?.planTotalCents ?? 0)).toBe(10_000);
  });

  it('keeps a single-day event (no endDate) on its planned day', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-08',
      occurrences: [
        mkOccurrence({ id: 'occ-one', plannedDate: '2026-06-11', endDate: null, reservedCents: 6_000 }),
      ],
      plannedPurchases: [],
    });
    const d11 = map.days.find((d) => d.dateIso === '2026-06-11');
    expect(d11?.planTotalCents).toBe(6_000);
    map.days
      .filter((d) => d.dateIso !== '2026-06-11')
      .forEach((d) => expect(d.planTotalCents).toBe(0));
  });
});

function mkEventExpense(occurrenceId: string, amountCents: number): Transaction {
  return createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: 'w1',
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'Event spend',
    occurrenceId,
  });
}

describe('buildPhaseAllowanceMap — DEC-391 (consumable event reserve in the day detail)', () => {
  // Phase 2026-06-08 → 2026-06-14; an event "Festas" spanning 06-10..06-12 (3 days)
  // with €100 reserved. Today is 06-10. The day detail must show what is STILL
  // held (reserve − spend) per remaining day, recomputing as money is spent —
  // never the full reserve flat across the days.
  const phase = mkPhase(null, null);
  const today = '2026-06-10';
  const eventDays = ['2026-06-10', '2026-06-11', '2026-06-12'];

  const eventShareOn = (map: ReturnType<typeof buildPhaseAllowanceMap>, dayIso: string) =>
    map.days.find((d) => d.dateIso === dayIso)?.planItems.find((i) => i.id === 'evt-festas')
      ?.amountCents ?? 0;

  const sumEventShares = (map: ReturnType<typeof buildPhaseAllowanceMap>) =>
    eventDays.reduce((acc, d) => acc + eventShareOn(map, d), 0);

  it('spreads the FULL reserve across remaining days when nothing was spent yet', () => {
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: today,
      occurrences: [
        mkOccurrence({ id: 'evt-festas', name: 'Festas', plannedDate: today, endDate: '2026-06-12', reservedCents: 10_000 }),
      ],
      plannedPurchases: [],
      transactions: [],
    });
    expect(sumEventShares(map)).toBe(10_000); // €100 split 3_333 + 3_333 + 3_334
    expect(eventShareOn(map, '2026-06-10')).toBe(3_333);
  });

  it('shows only the CONSUMABLE remainder once part of the reserve is spent (~€31,67/day)', () => {
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: today,
      occurrences: [
        mkOccurrence({ id: 'evt-festas', name: 'Festas', plannedDate: today, endDate: '2026-06-12', reservedCents: 10_000 }),
      ],
      plannedPurchases: [],
      transactions: [mkEventExpense('evt-festas', 500)], // €5 spent → €95 left
    });
    // €95 over the 3 remaining days = 3_166 + 3_166 + 3_168 (remainder rides last).
    expect(sumEventShares(map)).toBe(9_500);
    expect(eventShareOn(map, '2026-06-10')).toBe(3_166);
    expect(eventShareOn(map, '2026-06-12')).toBe(3_168);
  });

  it('places nothing on days OUTSIDE the event interval', () => {
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: today,
      occurrences: [
        mkOccurrence({ id: 'evt-festas', name: 'Festas', plannedDate: today, endDate: '2026-06-12', reservedCents: 10_000 }),
      ],
      plannedPurchases: [],
      transactions: [],
    });
    expect(eventShareOn(map, '2026-06-13')).toBe(0); // after the event ends
    expect(eventShareOn(map, '2026-06-14')).toBe(0);
  });

  it('a fully-consumed reserve leaves nothing on the day detail', () => {
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: today,
      occurrences: [
        mkOccurrence({ id: 'evt-festas', name: 'Festas', plannedDate: today, endDate: '2026-06-12', reservedCents: 10_000 }),
      ],
      plannedPurchases: [],
      transactions: [mkEventExpense('evt-festas', 12_000)], // spent past the reserve
    });
    expect(sumEventShares(map)).toBe(0);
  });

  it('an event whose days are all in the past contributes nothing (no division by zero)', () => {
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: today, // 06-10
      occurrences: [
        mkOccurrence({ id: 'evt-past', name: 'Ontem', plannedDate: '2026-06-08', endDate: '2026-06-09', reservedCents: 6_000 }),
      ],
      plannedPurchases: [],
      transactions: [],
    });
    expect(map.days.every((d) => d.planItems.every((i) => i.id !== 'evt-past'))).toBe(true);
  });
});

describe('buildPhaseAllowanceMap — GATE 19 (normalAllowanceCents / hasRhythm)', () => {
  it('uniform phase: no rhythm, normal allowance equals every day', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11', // Thu → Sun = 4 uniform days
      occurrences: [],
      plannedPurchases: [],
    });

    expect(map.hasRhythm).toBe(false);
    expect(map.normalAllowanceCents).toBe(10_000); // 40_000 / 4
    map.days.forEach((d) => expect(d.allowanceCents).toBe(map.normalAllowanceCents));
  });

  it('rhythm phase: normal allowance is the non-peak day; peak day is larger', () => {
    const phase = mkPhase('moderate', [5, 6]); // Fri(5)/Sat(6) peak, base 0.8
    // Thu→Sun weights: 0.8 + 1.5 + 1.5 + 0.8 = 4.6 effective days.
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 46_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11', // Thursday
      occurrences: [],
      plannedPurchases: [],
    });

    expect(map.hasRhythm).toBe(true);
    // 46_000 × 0.8 / 4.6 = 8_000 — the regular-day reference.
    expect(map.normalAllowanceCents).toBe(8_000);

    const thursday = map.days.find((d) => d.dateIso === '2026-06-11'); // non-peak
    const saturday = map.days.find((d) => d.dateIso === '2026-06-13'); // peak
    expect(thursday?.allowanceCents).toBe(map.normalAllowanceCents);
    // 46_000 × 1.5 / 4.6 = 15_000 — visibly more than the 8_000 normal day.
    expect(saturday?.allowanceCents).toBe(15_000);
    expect(saturday?.allowanceCents).toBeGreaterThan(map.normalAllowanceCents);
  });

  it('peak-days-only phase still reports rhythm with a 1.0 base reference', () => {
    const phase = mkPhase(null, [6]); // Sat peak, no preset → base 1.0
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 50_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [],
      plannedPurchases: [],
    });
    expect(map.hasRhythm).toBe(true);
    const thursday = map.days.find((d) => d.dateIso === '2026-06-11'); // base 1.0
    expect(map.normalAllowanceCents).toBe(thursday?.allowanceCents);
  });
});

describe('buildPhaseAllowanceMap — F20 day total (free + reserved)', () => {
  it('sums free and reserved into the day total (€63 free + €60 cream = €123)', () => {
    const phase = mkPhase(null, null);
    // From Thu → Sun = 4 uniform days; 25_200 / 4 = 6_300 free per day.
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 25_200,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [],
      plannedPurchases: [
        mkPurchase({ id: 'pp-cream', name: 'Face cream', targetDate: '2026-06-12', reservedCents: 6_000 }),
      ],
    });

    const creamDay = map.days.find((d) => d.dateIso === '2026-06-12');
    expect(creamDay?.freeCents).toBe(6_300);
    expect(creamDay?.planTotalCents).toBe(6_000);
    expect(creamDay?.dayTotalCents).toBe(12_300);
    // The total is exactly free + reserved — never more (no double counting).
    expect(creamDay?.dayTotalCents).toBe((creamDay?.freeCents ?? 0) + (creamDay?.planTotalCents ?? 0));
  });

  it('day total equals free on days with no reserves', () => {
    const phase = mkPhase(null, null);
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [],
      plannedPurchases: [],
    });

    map.days.forEach((d) => {
      expect(d.planTotalCents).toBe(0);
      expect(d.dayTotalCents).toBe(d.freeCents);
    });
  });

  it('maxDayTotalCents tracks the largest single-day total (free + reserved)', () => {
    const phase = mkPhase(null, null); // 4 uniform days → 10_000 free each
    const map = buildPhaseAllowanceMap({
      trueFreeCents: 40_000,
      todaySpentCents: 0,
      phase,
      todayIso: '2026-06-11',
      occurrences: [
        mkOccurrence({ id: 'occ-sat', plannedDate: '2026-06-13', reservedCents: 9_000 }),
      ],
      plannedPurchases: [],
    });

    const saturday = map.days.find((d) => d.dateIso === '2026-06-13');
    expect(saturday?.dayTotalCents).toBe(19_000); // 10_000 free + 9_000 reserved
    expect(map.maxDayTotalCents).toBe(19_000);
  });

  it("today's reserve layers on top without changing free (ÂNCORA: free == hero)", () => {
    const phase = mkPhase('moderate', [5, 6]);
    const trueFreeCents = 52_300;
    const todaySpentCents = 1_840;
    const todayIso = '2026-06-11';
    const map = buildPhaseAllowanceMap({
      trueFreeCents,
      todaySpentCents,
      phase,
      todayIso,
      occurrences: [
        mkOccurrence({ id: 'occ-today', plannedDate: todayIso, reservedCents: 3_000 }),
      ],
      plannedPurchases: [],
    });
    const today = calculateTodayFreeBudget(trueFreeCents, todaySpentCents, phase, todayIso);
    const td = map.days[0];

    expect(td?.isToday).toBe(true);
    // Reserving money does NOT change today's free — it still equals the hero.
    expect(td?.freeCents).toBe(today.freeTodayCents);
    // The day total simply re-surfaces the reserve for display.
    expect(td?.dayTotalCents).toBe(today.freeTodayCents + 3_000);
  });
});
