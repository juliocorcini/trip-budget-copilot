import { describe, it, expect } from 'vitest';
import { buildRescuePlan } from '@/domain/budget';

// DEC-132: rescue mode — pure calculator, nothing persisted.

describe('buildRescuePlan', () => {
  it('computes the new daily allowance and the daily cut', () => {
    const plan = buildRescuePlan({
      saveTargetCents: 10000,
      freeToSpendCents: 30000,
      remainingDays: 5,
      remainingOccasions: [],
    });

    expect(plan.feasible).toBe(true);
    expect(plan.currentDailyFreeCents).toBe(6000); // 300/5
    expect(plan.newDailyFreeCents).toBe(4000); // (300-100)/5
    expect(plan.dailyCutCents).toBe(2000);
  });

  it('marks the plan infeasible when the target exceeds the free budget', () => {
    const plan = buildRescuePlan({
      saveTargetCents: 40000,
      freeToSpendCents: 30000,
      remainingDays: 5,
      remainingOccasions: [],
    });

    expect(plan.feasible).toBe(false);
    expect(plan.newDailyFreeCents).toBe(0);
  });

  it('suggests skipping the most expensive occasions first (greedy cover)', () => {
    const plan = buildRescuePlan({
      saveTargetCents: 10000,
      freeToSpendCents: 50000,
      remainingDays: 5,
      remainingOccasions: [
        { profileId: 'bar', profileName: 'Bar', remaining: 3, typicalValueCents: 3500 },
        { profileId: 'club', profileName: 'Club', remaining: 1, typicalValueCents: 8000 },
      ],
    });

    // Club (8000) first, then 1× bar (3500) → 11500 covers the 10000 target.
    expect(plan.suggestions).toEqual([
      { profileId: 'club', profileName: 'Club', skipCount: 1, savingsCents: 8000 },
      { profileId: 'bar', profileName: 'Bar', skipCount: 1, savingsCents: 3500 },
    ]);
    expect(plan.coveredBySuggestionsCents).toBe(11500);
  });

  it('reports partial coverage when occasions cannot reach the target', () => {
    const plan = buildRescuePlan({
      saveTargetCents: 50000,
      freeToSpendCents: 60000,
      remainingDays: 5,
      remainingOccasions: [
        { profileId: 'bar', profileName: 'Bar', remaining: 2, typicalValueCents: 3500 },
      ],
    });

    expect(plan.suggestions).toEqual([
      { profileId: 'bar', profileName: 'Bar', skipCount: 2, savingsCents: 7000 },
    ]);
    expect(plan.coveredBySuggestionsCents).toBe(7000);
  });

  it('ignores occasions without value or without remaining count', () => {
    const plan = buildRescuePlan({
      saveTargetCents: 5000,
      freeToSpendCents: 30000,
      remainingDays: 5,
      remainingOccasions: [
        { profileId: 'free', profileName: 'Walk', remaining: 4, typicalValueCents: 0 },
        { profileId: 'done', profileName: 'Done', remaining: 0, typicalValueCents: 9000 },
      ],
    });
    expect(plan.suggestions).toEqual([]);
    expect(plan.coveredBySuggestionsCents).toBe(0);
  });

  it('never divides by zero days', () => {
    const plan = buildRescuePlan({
      saveTargetCents: 1000,
      freeToSpendCents: 5000,
      remainingDays: 0,
      remainingOccasions: [],
    });
    expect(plan.remainingDays).toBe(1);
    expect(plan.currentDailyFreeCents).toBe(5000);
  });
});
