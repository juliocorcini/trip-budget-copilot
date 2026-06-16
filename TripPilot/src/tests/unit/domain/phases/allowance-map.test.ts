import { describe, it, expect } from 'vitest';
import { buildPhaseAllowanceMap, calculateTodayFreeBudget } from '@/domain/phases';
import type { Phase, PhaseRhythmPreset } from '@/domain/types/phase';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';

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
