import { describe, it, expect } from 'vitest';
import {
  buildHonestFriendV2,
  getHonestFriendTone,
  projectReserveStartDate,
  evaluateBorrowFromTomorrow,
  verdictLeadsCarousel,
  type HonestFriendV2,
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
    trueFreeRawCents: 5_000,
    poolFreeRawCents: 5_000,
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

  it('G6: over_pace reconciles the category limit with phase slack', () => {
    // Category tight: 3 of 6 fit (3 overflow × €3 = €9 over the bar plan).
    // Phase free €50 comfortably covers €9 → overflow fits, guilt-free.
    const withSlack = buildHonestFriendV2(
      baseInput({
        plannedQuantity: 10,
        doneQuantity: 4,
        categorySpentCents: 2_100,
        freeToSpendCents: 5_000,
      }),
    );
    expect(withSlack.kind).toBe('over_pace');
    if (withSlack.kind === 'over_pace') {
      expect(withSlack.overflowCount).toBe(3); // 6 remaining − 3 that fit
      expect(withSlack.phaseFreeCents).toBe(5_000);
      expect(withSlack.overflowFitsPhase).toBe(true); // €50 ≥ 3 × €3
    }

    // Same category pressure, but the phase is nearly tapped (€6 free < €9
    // overflow) → the slack reconciliation must NOT claim it fits.
    const noSlack = buildHonestFriendV2(
      baseInput({
        plannedQuantity: 10,
        doneQuantity: 4,
        categorySpentCents: 2_100,
        freeToSpendCents: 600,
      }),
    );
    if (noSlack.kind === 'over_pace') {
      expect(noSlack.overflowCount).toBe(3);
      expect(noSlack.overflowFitsPhase).toBe(false); // €6 < 3 × €3
    }
  });

  it('DEC-115 (R-06): done > planned NEVER reads as "within plan"', () => {
    // The field bug: "20 of 5 occasions — within plan". Must be over_plan.
    const result = buildHonestFriendV2(
      baseInput({ plannedQuantity: 5, doneQuantity: 20, categorySpentCents: 6_000 }),
    );
    expect(result.kind).toBe('over_plan');
    if (result.kind === 'over_plan') {
      expect(result.doneQuantity).toBe(20);
      expect(result.plannedQuantity).toBe(5);
    }
  });

  it('done == planned still reads as on_plan (plan completed, not exceeded)', () => {
    const result = buildHonestFriendV2(
      baseInput({ plannedQuantity: 5, doneQuantity: 5, categorySpentCents: 1_500 }),
    );
    expect(result.kind).toBe('on_plan');
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

  // DEC-236 (Device Test 2026-06-18): PHASE TRUTH dominates the category read.
  it('true free spent past the protected reserve → over_budget, into the reserve', () => {
    // True free −€5.60 and pool free also −€5.60 → €5.60 came out of the reserve.
    const result = buildHonestFriendV2(
      baseInput({ freeToSpendCents: 0, trueFreeRawCents: -560, poolFreeRawCents: -560 }),
    );
    expect(result.kind).toBe('over_budget');
    if (result.kind === 'over_budget') {
      expect(result.reserveUsedCents).toBe(560);
      expect(result.planShortfallCents).toBe(0);
      expect(result.intoReserve).toBe(true);
    }
  });

  it('exactly at the free line (true free 0) → over_budget, reserve intact', () => {
    const result = buildHonestFriendV2(
      baseInput({ freeToSpendCents: 0, trueFreeRawCents: 0, poolFreeRawCents: 0 }),
    );
    expect(result.kind).toBe('over_budget');
    if (result.kind === 'over_budget') {
      expect(result.reserveUsedCents).toBe(0);
      expect(result.planShortfallCents).toBe(0);
      expect(result.intoReserve).toBe(false);
    }
  });

  it("Julio's backup: pool free POSITIVE but true free negative → over_budget, NOT 'fits the plan'", () => {
    // The real bug: pool free +€127.71 (so the OLD card said "1 of 2 fit"), but
    // the plan reserves €150.25 → TRUE free −€22.54. The reserve is intact, the
    // remainder is committed to the plan. Must read as over_budget with a plan
    // shortfall — never on_plan / over_pace.
    const result = buildHonestFriendV2(
      baseInput({
        freeToSpendCents: 12_771,
        trueFreeRawCents: -2_254,
        poolFreeRawCents: 12_771,
        plannedQuantity: 7,
        doneQuantity: 5,
        categorySpentCents: 9_000,
      }),
    );
    expect(result.kind).toBe('over_budget');
    if (result.kind === 'over_budget') {
      expect(result.intoReserve).toBe(false);
      expect(result.reserveUsedCents).toBe(0);
      expect(result.planShortfallCents).toBe(2_254);
    }
  });

  it('non-profile trigger (no profile, no plan) → no_plan with honest impact %', () => {
    // The €600 "Outros" while the phase still has €400 truly free → 60% of margin.
    const result = buildHonestFriendV2(
      baseInput({
        profileId: null,
        profileName: null,
        typicalValueCents: 0,
        plannedQuantity: 0,
        recentSpendCents: 60_000,
        freeToSpendCents: 40_000,
        trueFreeRawCents: 40_000,
        poolFreeRawCents: 40_000,
      }),
    );
    expect(result.kind).toBe('no_plan');
    if (result.kind === 'no_plan') {
      expect(result.impactPercent).toBe(60);
    }
  });
});

describe('getHonestFriendTone (D-BUG-11 / D-DEC-E)', () => {
  const overPace = (over: Partial<Extract<HonestFriendV2, { kind: 'over_pace' }>> = {}): HonestFriendV2 => ({
    kind: 'over_pace',
    profileId: 'p',
    profileName: 'Bar',
    plannedQuantity: 10,
    doneQuantity: 4,
    remainingPlanned: 6,
    fitCount: 3,
    reserveStartDate: null,
    overflowCount: 3,
    phaseFreeCents: 5_000,
    overflowFitsPhase: true,
    ...over,
  });

  it('within plan → positive (green)', () => {
    expect(
      getHonestFriendTone({
        kind: 'on_plan',
        profileId: 'p',
        profileName: 'Bar',
        plannedQuantity: 10,
        doneQuantity: 4,
        remainingPlanned: 6,
      }),
    ).toBe('positive');
  });

  it('over pace but the phase slack absorbs the overflow → steady, NOT positive', () => {
    expect(getHonestFriendTone(overPace({ overflowFitsPhase: true }))).toBe('steady');
  });

  it('steady wins even when a reserve date is projected (slack still covers it)', () => {
    expect(
      getHonestFriendTone(overPace({ overflowFitsPhase: true, reserveStartDate: '2026-06-15' })),
    ).toBe('steady');
  });

  it('over pace, slack does NOT cover, reserve safe → caution (amber)', () => {
    expect(
      getHonestFriendTone(overPace({ overflowFitsPhase: false, reserveStartDate: null })),
    ).toBe('caution');
  });

  it('over pace, slack does NOT cover, reserve at risk → alert (red)', () => {
    expect(
      getHonestFriendTone(overPace({ overflowFitsPhase: false, reserveStartDate: '2026-06-15' })),
    ).toBe('alert');
  });

  it('over plan escalates by the reserve date', () => {
    const base = {
      kind: 'over_plan' as const,
      profileId: 'p',
      profileName: 'Bar',
      plannedQuantity: 5,
      doneQuantity: 8,
    };
    expect(getHonestFriendTone({ ...base, reserveStartDate: null })).toBe('caution');
    expect(getHonestFriendTone({ ...base, reserveStartDate: '2026-06-15' })).toBe('alert');
  });

  it('no plan → neutral', () => {
    expect(
      getHonestFriendTone({
        kind: 'no_plan',
        impactPercent: 20,
      }),
    ).toBe('neutral');
  });

  it('DEC-236: over budget → alert (red), the loudest honest signal', () => {
    expect(
      getHonestFriendTone({
        kind: 'over_budget',
        reserveUsedCents: 560,
        planShortfallCents: 0,
        intoReserve: true,
      }),
    ).toBe('alert');
    expect(
      getHonestFriendTone({
        kind: 'over_budget',
        reserveUsedCents: 0,
        planShortfallCents: 2_254,
        intoReserve: false,
      }),
    ).toBe('alert');
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

describe('evaluateBorrowFromTomorrow (E2 / M12 / DEC-053)', () => {
  it('fits today → no borrow', () => {
    // €30 spend, €50 today, €200 phase free → comfortably within today.
    expect(evaluateBorrowFromTomorrow(3_000, 5_000, 20_000).kind).toBe('none');
  });

  it('overflows today but fits the phase → borrow warning with math', () => {
    // €80 spend, €50 today, €200 phase free.
    const result = evaluateBorrowFromTomorrow(8_000, 5_000, 20_000);
    expect(result.kind).toBe('borrow_tomorrow');
    if (result.kind === 'borrow_tomorrow') {
      expect(result.todayNegativeCents).toBe(3_000); // 8000 − 5000
      expect(result.remainingAfterCents).toBe(12_000); // 20000 − 8000
    }
  });

  it('overflows the whole phase → real overspend, not a borrow', () => {
    // €250 spend, €50 today, €200 phase free → exceeds free entirely.
    expect(evaluateBorrowFromTomorrow(25_000, 5_000, 20_000).kind).toBe('none');
  });

  it('no daily allowance (off-rhythm day) → no borrow', () => {
    expect(evaluateBorrowFromTomorrow(8_000, null, 20_000).kind).toBe('none');
  });

  it('spend exactly equal to today allowance → no borrow', () => {
    expect(evaluateBorrowFromTomorrow(5_000, 5_000, 20_000).kind).toBe('none');
  });

  it('spend exactly equal to phase free (above today) → borrow at the limit', () => {
    const result = evaluateBorrowFromTomorrow(20_000, 5_000, 20_000);
    expect(result.kind).toBe('borrow_tomorrow');
    if (result.kind === 'borrow_tomorrow') {
      expect(result.remainingAfterCents).toBe(0);
    }
  });

  it('non-positive amount → no borrow', () => {
    expect(evaluateBorrowFromTomorrow(0, 5_000, 20_000).kind).toBe('none');
  });
});

// DEC-417 (G5): a plain `no_plan` verdict ("this expense took X%") is the weakest,
// most repetitive read — it yields the carousel lead to a rhythm read when one
// exists. Every stronger verdict always leads.
describe('verdictLeadsCarousel (DEC-417)', () => {
  it('no_plan yields the lead when a rhythm read exists', () => {
    expect(verdictLeadsCarousel('no_plan', true)).toBe(false);
  });

  it('no_plan keeps the lead when there is no rhythm read to defer to', () => {
    expect(verdictLeadsCarousel('no_plan', false)).toBe(true);
  });

  it('every stronger verdict leads regardless of rhythm reads', () => {
    for (const kind of ['over_budget', 'over_pace', 'over_plan', 'on_plan'] as const) {
      expect(verdictLeadsCarousel(kind, true)).toBe(true);
      expect(verdictLeadsCarousel(kind, false)).toBe(true);
    }
  });
});
