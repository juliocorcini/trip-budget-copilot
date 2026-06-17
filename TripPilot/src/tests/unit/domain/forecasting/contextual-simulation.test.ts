import { describe, it, expect } from 'vitest';
import {
  simulateContextualSpend,
  type ContextualSimulationInput,
  type SimulationProfileContext,
  type SimulationEventContext,
  type SimulationReserveContext,
} from '@/domain/forecasting';

// DEC-116 (R-07): Simulator v3 — contextual engine tests.

const dinnerProfile: SimulationProfileContext = {
  profileId: 'p-dinner',
  profileName: 'Jantar fora',
  plannedQuantity: 5,
  doneQuantity: 2,
  remaining: 3,
  typicalValueCents: 2000, // €20 typical dinner
  categorySpentCents: 4000, // 2 typical dinners spent (well within the €100 plan)
};

const noPlanProfile: SimulationProfileContext = {
  profileId: 'p-museum',
  profileName: 'Museus',
  plannedQuantity: 0,
  doneQuantity: 0,
  remaining: 0,
  typicalValueCents: 0,
  categorySpentCents: 0,
};

const concertEvent: SimulationEventContext = {
  occurrenceId: 'e-concert',
  name: 'Show do Coldplay',
  reservedCents: 10000, // €100 reserved
};

const creamsPlanned: SimulationReserveContext = {
  id: 'pp-creams',
  name: 'Cremes skincare',
  reservedCents: 8000, // €80 reserved
};

function buildInput(overrides: Partial<ContextualSimulationInput>): ContextualSimulationInput {
  return {
    amountCents: 2000,
    target: { kind: 'other' },
    freeToSpendCents: 50000,
    todayAllowanceCents: null,
    profiles: [dinnerProfile, noPlanProfile],
    events: [concertEvent],
    planned: [creamsPlanned],
    ...overrides,
  };
}

describe('simulateContextualSpend — profile target with plan', () => {
  it('treats one typical occasion as planned money (ok: fits_plan)', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000, // exactly one typical dinner
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'ok',
      reason: 'fits_plan',
      profileName: 'Jantar fora',
      remaining: 3,
    });
    const planFact = result.facts.find((f) => f.kind === 'plan_consumption');
    expect(planFact).toMatchObject({ occasions: 1, remaining: 3, typicalValueCents: 2000 });
  });

  it('warns when the amount consumes multiple planned occasions', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 4400, // ≈2.2 dinners of €20
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'attention',
      reason: 'consumes_occasions',
      profileName: 'Jantar fora',
      occasions: 2.2,
    });
  });

  it('flags risk when the amount eats the whole remaining plan', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 6000, // 3 dinners = everything remaining
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'risk',
      reason: 'consumes_whole_plan',
      profileName: 'Jantar fora',
      remaining: 3,
    });
  });

  it('flags over_plan when the plan is already used up', () => {
    const usedUp: SimulationProfileContext = {
      ...dinnerProfile,
      doneQuantity: 5,
      remaining: 0,
    };
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000,
        profiles: [usedUp],
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'risk',
      reason: 'over_plan',
      profileName: 'Jantar fora',
      planned: 5,
      done: 5,
    });
    expect(result.facts[0]).toMatchObject({ kind: 'plan_over', planned: 5, done: 5 });
  });
});

describe('simulateContextualSpend — category money-plan weighting (B12/R7)', () => {
  // €100 dining plan (5 × €20). Occasions remain, but the money is gone.
  it('escalates an otherwise-ok spend when it tips the category over its money plan', () => {
    const blownDinner: SimulationProfileContext = {
      ...dinnerProfile,
      doneQuantity: 1,
      remaining: 4, // plenty of occasions left
      categorySpentCents: 9500, // €95 already spent of the €100 plan
    };
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000, // one typical dinner — normally ok/fits_plan
        profiles: [blownDinner],
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    // €95 + €20 = €115 → €15 over the €100 plan; tips over now → attention.
    expect(result.verdict).toEqual({
      tone: 'attention',
      reason: 'category_over_budget',
      profileName: 'Jantar fora',
      overByCents: 1500,
    });
    expect(result.facts[0]).toEqual({
      kind: 'category_over_budget',
      profileName: 'Jantar fora',
      spentCents: 9500,
      budgetCents: 10000,
      overByCents: 1500,
    });
  });

  it('flags risk when the category was already over its money plan', () => {
    const overDinner: SimulationProfileContext = {
      ...dinnerProfile,
      doneQuantity: 2,
      remaining: 3,
      categorySpentCents: 11000, // already €10 over the €100 plan
    };
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000,
        profiles: [overDinner],
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'risk',
      reason: 'category_over_budget',
      profileName: 'Jantar fora',
      overByCents: 3000, // €110 + €20 − €100
    });
  });

  it('keeps the stronger consumes_whole_plan verdict but still surfaces the money fact', () => {
    const overDinner: SimulationProfileContext = {
      ...dinnerProfile,
      doneQuantity: 2,
      remaining: 3,
      categorySpentCents: 9000,
    };
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 6000, // 3 dinners = whole remaining plan → risk
        profiles: [overDinner],
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'risk',
      reason: 'consumes_whole_plan',
      profileName: 'Jantar fora',
      remaining: 3,
    });
    expect(result.facts.some((f) => f.kind === 'category_over_budget')).toBe(true);
  });

  it('does NOT weight when the category stays within its money plan', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000, // €40 + €20 = €60 ≤ €100 plan
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'ok',
      reason: 'fits_plan',
      profileName: 'Jantar fora',
      remaining: 3,
    });
    expect(result.facts.some((f) => f.kind === 'category_over_budget')).toBe(false);
  });
});

describe('simulateContextualSpend — profile target without plan', () => {
  it('falls back to an honest free-margin analysis', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000,
        freeToSpendCents: 50000,
        target: { kind: 'profile', profileId: 'p-museum' },
      }),
    );
    expect(result.verdict).toEqual({ tone: 'ok', reason: 'fits_free' });
    expect(result.facts[0]).toMatchObject({
      kind: 'free_impact',
      freeCents: 50000,
      afterCents: 48000,
    });
  });

  it('uses the daily allowance perspective when available (field scenario)', () => {
    // Field report: €20 dinner with €5.24 daily free → ≈3.8 days of it.
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000,
        freeToSpendCents: 50000,
        todayAllowanceCents: 524,
        target: { kind: 'profile', profileId: 'p-museum' },
      }),
    );
    const dailyFact = result.facts.find((f) => f.kind === 'daily_days');
    expect(dailyFact).toMatchObject({ allowanceCents: 524, days: 3.8 });
    expect(result.verdict).toEqual({ tone: 'risk', reason: 'many_days', days: 3.8 });
  });
});

describe('simulateContextualSpend — event target', () => {
  it('is calm when the reserve covers the amount', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 8000,
        target: { kind: 'event', occurrenceId: 'e-concert' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'ok',
      reason: 'reserve_covers',
      eventName: 'Show do Coldplay',
    });
    expect(result.facts).toEqual([
      {
        kind: 'event_reserve_covers',
        eventName: 'Show do Coldplay',
        reservedCents: 10000,
        leftCents: 2000,
      },
    ]);
  });

  it('warns when the reserve is short and the rest fits the free margin', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 14000, // €40 over the €100 reserve
        freeToSpendCents: 50000,
        target: { kind: 'event', occurrenceId: 'e-concert' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'attention',
      reason: 'reserve_short',
      eventName: 'Show do Coldplay',
      missingCents: 4000,
    });
    expect(result.facts[0]).toMatchObject({
      kind: 'event_reserve_short',
      reservedCents: 10000,
      missingCents: 4000,
    });
  });

  it('analyzes against the free margin when the event has no reserve', () => {
    const bareEvent: SimulationEventContext = {
      occurrenceId: 'e-bare',
      name: 'Passeio de barco',
      reservedCents: 0,
    };
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000,
        events: [bareEvent],
        target: { kind: 'event', occurrenceId: 'e-bare' },
      }),
    );
    expect(result.facts[0]).toEqual({ kind: 'event_no_reserve', eventName: 'Passeio de barco' });
    expect(result.verdict).toEqual({ tone: 'ok', reason: 'fits_free' });
  });
});

describe('simulateContextualSpend — planned purchase target (DEC-175)', () => {
  it('is calm when the planned reserve covers the amount', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 6000,
        target: { kind: 'planned', plannedPurchaseId: 'pp-creams' },
      }),
    );
    expect(result.verdict).toEqual({
      tone: 'ok',
      reason: 'reserve_covers',
      eventName: 'Cremes skincare',
    });
    expect(result.facts).toEqual([
      {
        kind: 'event_reserve_covers',
        eventName: 'Cremes skincare',
        reservedCents: 8000,
        leftCents: 2000,
      },
    ]);
  });

  it('warns when the planned reserve is short and the rest fits free', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 10000, // €20 over the €80 reserve
        freeToSpendCents: 50000,
        target: { kind: 'planned', plannedPurchaseId: 'pp-creams' },
      }),
    );
    expect(result.verdict).toMatchObject({ reason: 'reserve_short', missingCents: 2000 });
    expect(result.facts[0]).toMatchObject({
      kind: 'event_reserve_short',
      reservedCents: 8000,
      missingCents: 2000,
    });
  });

  it('falls back to the free margin for a track-only purchase (no reserve)', () => {
    const trackOnly: SimulationReserveContext = {
      id: 'pp-clothes',
      name: 'Roupas',
      reservedCents: 0,
    };
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 2000,
        planned: [trackOnly],
        target: { kind: 'planned', plannedPurchaseId: 'pp-clothes' },
      }),
    );
    expect(result.facts[0]).toEqual({ kind: 'event_no_reserve', eventName: 'Roupas' });
    expect(result.verdict).toEqual({ tone: 'ok', reason: 'fits_free' });
  });
});

describe('simulateContextualSpend — large values and free margin', () => {
  it('flags risk with the missing amount when it exceeds the free margin', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 60000,
        freeToSpendCents: 50000,
        target: { kind: 'other' },
      }),
    );
    expect(result.verdict).toEqual({ tone: 'risk', reason: 'exceeds_free', missingCents: 10000 });
    expect(result.facts[0]).toMatchObject({ kind: 'exceeds_free', missingCents: 10000 });
  });

  it('warns about large share of the remaining free margin', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 30000, // 60% of the free margin
        freeToSpendCents: 50000,
        target: { kind: 'other' },
      }),
    );
    expect(result.verdict).toEqual({ tone: 'attention', reason: 'large_share', percent: 60 });
  });

  it('exceeds-free wins even when a plan target was chosen', () => {
    const result = simulateContextualSpend(
      buildInput({
        amountCents: 60000,
        freeToSpendCents: 50000,
        target: { kind: 'profile', profileId: 'p-dinner' },
      }),
    );
    expect(result.verdict).toEqual({ tone: 'risk', reason: 'exceeds_free', missingCents: 10000 });
  });
});
