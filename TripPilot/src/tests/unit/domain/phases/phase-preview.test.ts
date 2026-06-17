import { describe, it, expect } from 'vitest';
import { buildPhasePreview, calculateTodayFreeBudget } from '@/domain/phases';
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

function mkPhase(
  rhythmPreset: PhaseRhythmPreset | null,
  peakDays: number[] | null,
  plannedIncomeCents?: number,
): Phase {
  return {
    ...meta,
    id: 'ph-1',
    tripId: 'trip-1',
    name: 'Tomorrowland',
    // 2026-06-08 is a Monday; 2026-06-14 is a Sunday → 7 days inclusive.
    startDate: '2026-06-08',
    endDate: '2026-06-14',
    order: 0,
    rhythmPreset,
    peakDays,
    notes: null,
    plannedIncomeCents,
  };
}

function mkPurchase(over: Partial<PlannedPurchase>): PlannedPurchase {
  return {
    ...meta,
    id: 'pp-1',
    tripId: 'trip-1',
    budgetPoolId: 'pool-1',
    name: 'Festival ticket',
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

function mkOccurrence(over: Partial<PlannedOccurrence>): PlannedOccurrence {
  return {
    ...meta,
    id: 'occ-1',
    tripId: 'trip-1',
    phaseId: 'ph-1',
    activityProfileId: null,
    budgetPoolId: 'pool-1',
    name: 'Main stage',
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

describe('buildPhasePreview (F18 — phase day-one projection)', () => {
  it('anchors the projection at the phase start and spans every day', () => {
    const phase = mkPhase(null, null);
    const preview = buildPhasePreview({
      phase,
      phaseFreeCents: 70_000,
      plannedIncomeCents: 0,
      occurrences: [],
      plannedPurchases: [],
    });

    expect(preview.startIso).toBe('2026-06-08');
    expect(preview.totalDays).toBe(7);
    expect(preview.map.days).toHaveLength(7);
    // Day one is the anchor — the projection treats the start as "today".
    expect(preview.map.days[0]?.dateIso).toBe('2026-06-08');
    expect(preview.map.days[0]?.isToday).toBe(true);
    // Nothing is spent in a day-one projection.
    preview.map.days.forEach((d) => expect(d.spentCents).toBe(0));
  });

  it('distributes phaseFree + plannedIncome evenly on a uniform phase', () => {
    const phase = mkPhase(null, null);
    const preview = buildPhasePreview({
      phase,
      phaseFreeCents: 63_000,
      plannedIncomeCents: 7_000,
      occurrences: [],
      plannedPurchases: [],
    });

    // 63_000 + 7_000 = 70_000 over 7 uniform days = 10_000/day.
    expect(preview.previewBaseCents).toBe(70_000);
    expect(preview.avgPerDayCents).toBe(10_000);
    preview.map.days.forEach((d) => {
      expect(d.allowanceCents).toBe(10_000);
      expect(d.freeCents).toBe(10_000);
    });
  });

  it('planned income raises every day vs no income (same phaseFree)', () => {
    const phase = mkPhase(null, null);
    const without = buildPhasePreview({
      phase,
      phaseFreeCents: 70_000,
      plannedIncomeCents: 0,
      occurrences: [],
      plannedPurchases: [],
    });
    const withIncome = buildPhasePreview({
      phase,
      phaseFreeCents: 70_000,
      plannedIncomeCents: 70_000,
      occurrences: [],
      plannedPurchases: [],
    });

    expect(withIncome.previewBaseCents).toBe(without.previewBaseCents + 70_000);
    withIncome.map.days.forEach((day, i) => {
      expect(day.allowanceCents).toBeGreaterThan(without.map.days[i]!.allowanceCents);
    });
    // Doubling the base doubles each day's allowance.
    expect(withIncome.avgPerDayCents).toBe(without.avgPerDayCents * 2);
  });

  it('respects the phase rhythm — peak days get a larger projected allowance', () => {
    const phase = mkPhase('moderate', [5, 6]); // Fri(5)/Sat(6) peak
    const preview = buildPhasePreview({
      phase,
      phaseFreeCents: 100_000,
      plannedIncomeCents: 0,
      occurrences: [],
      plannedPurchases: [],
    });

    const saturday = preview.map.days.find((d) => d.dateIso === '2026-06-13');
    const monday = preview.map.days.find((d) => d.dateIso === '2026-06-08');
    expect(saturday?.isPeakDay).toBe(true);
    expect((saturday?.allowanceCents ?? 0)).toBeGreaterThan(monday?.allowanceCents ?? 0);
  });

  it('overlays dated reserves on their day (free + reserved = day total)', () => {
    const phase = mkPhase(null, null);
    const preview = buildPhasePreview({
      phase,
      phaseFreeCents: 70_000, // 10_000/day free
      plannedIncomeCents: 0,
      occurrences: [
        mkOccurrence({ id: 'occ-sat', plannedDate: '2026-06-13', reservedCents: 6_000 }),
      ],
      plannedPurchases: [
        mkPurchase({ id: 'pp-sat', targetDate: '2026-06-13', reservedCents: 5_000 }),
      ],
    });

    const saturday = preview.map.days.find((d) => d.dateIso === '2026-06-13');
    expect(saturday?.planTotalCents).toBe(11_000);
    expect(saturday?.freeCents).toBe(10_000);
    expect(saturday?.dayTotalCents).toBe(21_000);
  });

  it('lists undated trip-wide purchases apart from the calendar', () => {
    const phase = mkPhase(null, null);
    const preview = buildPhasePreview({
      phase,
      phaseFreeCents: 70_000,
      plannedIncomeCents: 0,
      occurrences: [],
      plannedPurchases: [mkPurchase({ id: 'pp-undated', targetDate: null, reservedCents: 8_000 })],
    });

    expect(preview.map.undatedPlanItems).toHaveLength(1);
    expect(preview.map.undatedPlanTotalCents).toBe(8_000);
  });

  it('clamps negative free-to-spend and income to zero', () => {
    const phase = mkPhase(null, null);
    const preview = buildPhasePreview({
      phase,
      phaseFreeCents: -5_000,
      plannedIncomeCents: -1_000,
      occurrences: [],
      plannedPurchases: [],
    });

    expect(preview.phaseFreeCents).toBe(0);
    expect(preview.plannedIncomeCents).toBe(0);
    expect(preview.previewBaseCents).toBe(0);
    expect(preview.avgPerDayCents).toBe(0);
    preview.map.days.forEach((d) => expect(d.allowanceCents).toBe(0));
  });
});

describe('F17 planned income — ÂNCORA 11 invariance', () => {
  it("planned income on a phase NEVER changes today's free-to-spend", () => {
    const phaseNoIncome = mkPhase('moderate', [5, 6], 0);
    const phaseWithIncome = mkPhase('moderate', [5, 6], 500_000);
    const trueFreeCents = 52_300;
    const todaySpentCents = 1_840;
    const todayIso = '2026-06-11';

    const a = calculateTodayFreeBudget(trueFreeCents, todaySpentCents, phaseNoIncome, todayIso);
    const b = calculateTodayFreeBudget(trueFreeCents, todaySpentCents, phaseWithIncome, todayIso);

    // `calculateTodayFreeBudget` ignores `plannedIncomeCents` entirely — proving
    // F17 stays in the future-vision projection and never leaks into today.
    expect(b).toEqual(a);
  });
});
