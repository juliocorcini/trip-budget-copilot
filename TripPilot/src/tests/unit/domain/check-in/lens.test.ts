import { describe, it, expect } from 'vitest';
import { getCheckInLens, estimateNightRounds, deriveAvgRoundCents } from '@/domain/check-in';

describe('check-in "lens of the day" (E5)', () => {
  it('maps each mode to the card it spotlights', () => {
    expect(getCheckInLens('calm').focusCardId).toBe('piggy_bank');
    expect(getCheckInLens('outing').focusCardId).toBe('occasion_counters');
    // Night has no card focus — it projects rounds inline instead.
    expect(getCheckInLens('night').focusCardId).toBeNull();
    // The lens always echoes the intent it was built for.
    expect(getCheckInLens('calm').intent).toBe('calm');
  });

  it('estimateNightRounds floors the reserve by the round price', () => {
    // €50,00 night reserve ÷ €3,50 a round = 14 rounds (5000/350 = 14.28 → 14).
    expect(estimateNightRounds(5000, 350)).toBe(14);
    // Exact and just-under cases floor correctly.
    expect(estimateNightRounds(700, 350)).toBe(2);
    expect(estimateNightRounds(699, 350)).toBe(1);
  });

  it('estimateNightRounds returns null when it cannot form an honest number', () => {
    expect(estimateNightRounds(5000, null)).toBeNull();
    expect(estimateNightRounds(5000, 0)).toBeNull();
    expect(estimateNightRounds(5000, -10)).toBeNull();
    expect(estimateNightRounds(0, 350)).toBeNull();
    expect(estimateNightRounds(-100, 350)).toBeNull();
    // Below one round's price → 0 rounds, surfaced as null (no "≈ 0 rounds").
    expect(estimateNightRounds(200, 350)).toBeNull();
  });

  it('deriveAvgRoundCents prefers a bar/night profile price', () => {
    const profiles = [
      { category: 'restaurant', defaultAvgDrinkPriceCents: 900 },
      { category: 'bar', defaultAvgDrinkPriceCents: 350 },
      { category: 'market', defaultAvgDrinkPriceCents: 500 },
    ];
    expect(deriveAvgRoundCents(profiles)).toBe(350);
    expect(deriveAvgRoundCents([{ category: 'night', defaultAvgDrinkPriceCents: 420 }])).toBe(420);
  });

  it('deriveAvgRoundCents falls back to the cheapest configured round', () => {
    const profiles = [
      { category: 'restaurant', defaultAvgDrinkPriceCents: 900 },
      { category: 'market', defaultAvgDrinkPriceCents: 500 },
    ];
    expect(deriveAvgRoundCents(profiles)).toBe(500);
  });

  it('deriveAvgRoundCents ignores null/zero prices and returns null when none set', () => {
    expect(
      deriveAvgRoundCents([
        { category: 'bar', defaultAvgDrinkPriceCents: null },
        { category: 'restaurant', defaultAvgDrinkPriceCents: 0 },
      ]),
    ).toBeNull();
    expect(deriveAvgRoundCents([])).toBeNull();
    // A null-priced bar does not win over a real fallback price.
    expect(
      deriveAvgRoundCents([
        { category: 'bar', defaultAvgDrinkPriceCents: null },
        { category: 'restaurant', defaultAvgDrinkPriceCents: 800 },
      ]),
    ).toBe(800);
  });
});
