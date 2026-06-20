import { describe, it, expect } from 'vitest';
import { buildHonestFriendExtras } from '@/domain/budget';
import type { HonestFriendExtrasInput } from '@/domain/budget';

/**
 * DEC-093 follow-up (device-test 2026-06-20): the Amigo Sincero got "stuck" on a
 * single verdict ("esse gasto levou 1%..."). These extras feed a carousel with
 * more honest, data-grounded reads. Each extra is GATED on being informative, so
 * an empty trip yields nothing to pad.
 */

const base: HonestFriendExtrasInput = {
  phaseSpentCents: 0,
  phaseBudgetCents: 0,
  freeToSpendCents: 0,
  daysLeftInPhase: 0,
  topCategoryKey: null,
  topCategoryCents: 0,
  receivableCents: 0,
};

describe('buildHonestFriendExtras', () => {
  it('returns nothing for an empty/zeroed phase (no padding)', () => {
    expect(buildHonestFriendExtras(base)).toEqual([]);
  });

  it('builds phase progress percent (rounded, clamped) and flags ≥90% as caution', () => {
    const extras = buildHonestFriendExtras({ ...base, phaseSpentCents: 9500, phaseBudgetCents: 10000 });
    const progress = extras.find((e) => e.id === 'phase_progress');
    expect(progress).toBeDefined();
    expect(progress).toMatchObject({ id: 'phase_progress', percent: 95, tone: 'caution' });
  });

  it('computes daily-left from free-to-spend ÷ days (floored)', () => {
    const extras = buildHonestFriendExtras({
      ...base,
      freeToSpendCents: 10000,
      daysLeftInPhase: 3,
    });
    const daily = extras.find((e) => e.id === 'daily_left');
    // 10000 / 3 = 3333.33 → floor 3333; never overshoot what's actually free.
    expect(daily).toMatchObject({ id: 'daily_left', days: 3, perDayCents: 3333 });
  });

  it('omits daily-left when there is no free money or no days left', () => {
    expect(
      buildHonestFriendExtras({ ...base, freeToSpendCents: 0, daysLeftInPhase: 5 }).some(
        (e) => e.id === 'daily_left',
      ),
    ).toBe(false);
    expect(
      buildHonestFriendExtras({ ...base, freeToSpendCents: 5000, daysLeftInPhase: 0 }).some(
        (e) => e.id === 'daily_left',
      ),
    ).toBe(false);
  });

  it('builds the top-category share of total spend', () => {
    const extras = buildHonestFriendExtras({
      ...base,
      phaseSpentCents: 20000,
      topCategoryKey: 'food',
      topCategoryCents: 5000,
    });
    const top = extras.find((e) => e.id === 'top_category');
    expect(top).toMatchObject({
      id: 'top_category',
      categoryKey: 'food',
      amountCents: 5000,
      percent: 25,
    });
  });

  it('surfaces a positive receivable', () => {
    const extras = buildHonestFriendExtras({ ...base, receivableCents: 4200 });
    expect(extras.find((e) => e.id === 'receivable')).toMatchObject({
      id: 'receivable',
      amountCents: 4200,
      tone: 'positive',
    });
  });

  it('returns extras in a stable, predictable order when all qualify', () => {
    const extras = buildHonestFriendExtras({
      phaseSpentCents: 5000,
      phaseBudgetCents: 10000,
      freeToSpendCents: 5000,
      daysLeftInPhase: 5,
      topCategoryKey: 'food',
      topCategoryCents: 2500,
      receivableCents: 1000,
    });
    expect(extras.map((e) => e.id)).toEqual([
      'phase_progress',
      'daily_left',
      'top_category',
      'receivable',
    ]);
  });
});
