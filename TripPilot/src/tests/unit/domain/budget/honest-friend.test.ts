import { describe, it, expect } from 'vitest';
import {
  buildHonestFriendV2,
  projectReserveStartDate,
  type HonestFriendV2Input,
} from '@/domain/budget';
import type { Phase } from '@/domain/types/phase';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const phase: Phase = {
  ...meta,
  id: 'ph-1',
  tripId: 'trip-1',
  name: 'Eurotrip',
  startDate: '2026-06-01',
  endDate: '2026-06-20',
  order: 0,
  rhythmPreset: null,
  peakDays: null,
  notes: null,
};

function baseInput(overrides: Partial<HonestFriendV2Input> = {}): HonestFriendV2Input {
  return {
    profileId: 'prof-bar',
    profileName: 'Bar',
    typicalValueCents: 300,
    plannedQuantity: 10,
    doneQuantity: 4,
    categorySpentCents: 1_200,
    recentSpendCents: 300,
    freeToSpendCents: 5_000,
    phaseSpentCents: 3_000,
    phaseBudgetCents: 10_000,
    todayDate: '2026-06-10',
    phase,
    ...overrides,
  };
}

describe('buildHonestFriendV2 (DEC-093 / R-11)', () => {
  it('NEVER produces balance÷typical counts — base is always the plan', () => {
    // Free €525, typical €3 → the OLD model would say "175 outings". The new
    // model talks about the 10 PLANNED ones only.
    const result = buildHonestFriendV2(
      baseInput({ freeToSpendCents: 52_500, plannedQuantity: 10 }),
    );
    expect(result.kind).not.toBe('none');
    if (result.kind === 'on_plan' || result.kind === 'over_pace') {
      expect(result.plannedQuantity).toBe(10);
      expect(result.plannedQuantity).toBeLessThan(175);
    }
  });

  it('within plan → positive reinforcement with done/planned', () => {
    // 10 planned × €3 = €30 budget; spent €12 in 4 done → 6 remaining fit.
    const result = buildHonestFriendV2(
      baseInput({ plannedQuantity: 10, doneQuantity: 4, categorySpentCents: 1_200 }),
    );
    expect(result.kind).toBe('on_plan');
    if (result.kind === 'on_plan') {
      expect(result.doneQuantity).toBe(4);
      expect(result.remainingPlanned).toBe(6);
    }
  });

  it('overspending the category → "fit M of K remaining"', () => {
    // 10 planned × €3 = €30; already spent €21 in 4 outings (expensive ones)
    // → €9 left fits 3 of the 6 remaining.
    const result = buildHonestFriendV2(
      baseInput({ plannedQuantity: 10, doneQuantity: 4, categorySpentCents: 2_100 }),
    );
    expect(result.kind).toBe('over_pace');
    if (result.kind === 'over_pace') {
      expect(result.remainingPlanned).toBe(6);
      expect(result.fitCount).toBe(3);
    }
  });

  it('no plan for the category → impact on phase free margin, never counts', () => {
    const result = buildHonestFriendV2(
      baseInput({ plannedQuantity: 0, recentSpendCents: 1_000, freeToSpendCents: 9_000 }),
    );
    expect(result.kind).toBe('no_plan');
    if (result.kind === 'no_plan') {
      expect(result.impactPercent).toBe(10); // 1000 of 10000 before the spend
    }
  });

  it('no recent spend → no card', () => {
    expect(buildHonestFriendV2(baseInput({ recentSpendCents: 0 })).kind).toBe('none');
  });
});

describe('projectReserveStartDate (DEC-093 / R-11)', () => {
  it('pace exhausts the budget before phase end → projected date', () => {
    // 10 elapsed days (Jun 1-10), spent €90 of €120 → €9/day, €30 left
    // → ceil(30/9)=4 days → Jun 14.
    const date = projectReserveStartDate(phase, '2026-06-10', 9_000, 12_000);
    expect(date).toBe('2026-06-14');
  });

  it('comfortable pace → null (reserve never touched in the phase)', () => {
    // €30 in 10 days → €3/day; €90 left lasts 30 days > phase end.
    expect(projectReserveStartDate(phase, '2026-06-10', 3_000, 12_000)).toBeNull();
  });

  it('already over budget → reserve in use TODAY', () => {
    expect(projectReserveStartDate(phase, '2026-06-10', 13_000, 12_000)).toBe('2026-06-10');
  });
});
