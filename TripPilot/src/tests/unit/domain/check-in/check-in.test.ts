import { describe, it, expect } from 'vitest';
import {
  getActiveCheckIn,
  createDailyCheckIn,
  shouldPromptCheckIn,
  planCheckInDay,
  projectDailyBoostCents,
  CHECK_IN_INTENT_CATALOG,
} from '@/domain/check-in';

describe('check-in domain helpers (E5 — M7)', () => {
  it('createDailyCheckIn stamps the date and intent', () => {
    expect(createDailyCheckIn('night', '2026-06-13')).toEqual({
      date: '2026-06-13',
      intent: 'night',
    });
  });

  it('getActiveCheckIn returns the check-in only on the same day', () => {
    const checkIn = createDailyCheckIn('outing', '2026-06-13');
    expect(getActiveCheckIn(checkIn, '2026-06-13')).toEqual(checkIn);
    // Rolls over: yesterday's check-in is stale today.
    expect(getActiveCheckIn(checkIn, '2026-06-14')).toBeNull();
    expect(getActiveCheckIn(null, '2026-06-13')).toBeNull();
    expect(getActiveCheckIn(undefined, '2026-06-13')).toBeNull();
  });

  it('shouldPromptCheckIn is true only without an active check-in today', () => {
    const checkIn = createDailyCheckIn('calm', '2026-06-13');
    expect(shouldPromptCheckIn(null, '2026-06-13')).toBe(true);
    expect(shouldPromptCheckIn(checkIn, '2026-06-13')).toBe(false);
    // Stale check-in (different day) → prompt again.
    expect(shouldPromptCheckIn(checkIn, '2026-06-14')).toBe(true);
  });

  it('the intent catalog covers the four intents with icons + labels', () => {
    expect(CHECK_IN_INTENT_CATALOG.map((c) => c.intent)).toEqual([
      'calm',
      'outing',
      'night',
      'no_spend',
    ]);
    for (const entry of CHECK_IN_INTENT_CATALOG) {
      expect(entry.icon.length).toBeGreaterThan(0);
      expect(entry.labelKey).toContain('dashboard.checkin_');
    }
  });

  it('planCheckInDay gives each intent a DIFFERENT, read-only number plan', () => {
    const free = 10000; // €100,00 free today
    const calm = planCheckInDay('calm', free);
    const outing = planCheckInDay('outing', free);
    const night = planCheckInDay('night', free);
    const noSpend = planCheckInDay('no_spend', free);

    // Distinct messages + icons — picking a mode visibly changes the result.
    const messageKeys = new Set([
      calm.messageKey,
      outing.messageKey,
      night.messageKey,
      noSpend.messageKey,
    ]);
    expect(messageKeys.size).toBe(4);

    // Calm proposes a LIGHT target (spend less); the rest becomes slack.
    expect(calm.primaryCents).toBe(6000);
    expect(calm.secondaryCents).toBe(4000);
    // Outing uses the FULL amount, no split.
    expect(outing.primaryCents).toBe(free);
    expect(outing.secondaryCents).toBeNull();
    // Night reserves half for the night, the rest for earlier.
    expect(night.primaryCents).toBe(5000);
    expect(night.secondaryCents).toBe(5000);
    // No-spend: nothing today; the whole amount carries forward as slack.
    expect(noSpend.primaryCents).toBe(0);
    expect(noSpend.secondaryCents).toBe(free);

    // The two parts always reconstruct the honest free-today (read-only).
    expect(calm.primaryCents + (calm.secondaryCents ?? 0)).toBe(free);
    expect(night.primaryCents + (night.secondaryCents ?? 0)).toBe(free);
    expect(noSpend.primaryCents + (noSpend.secondaryCents ?? 0)).toBe(free);

    // K1: each mode carries stat labels so the result reads as numbers, not a
    // sentence. Modes with a split expose a secondary label; outing does not.
    expect(calm.primaryLabelKey).toContain('dashboard.checkin_stat_');
    expect(calm.secondaryLabelKey).toContain('dashboard.checkin_stat_');
    expect(night.secondaryLabelKey).toContain('dashboard.checkin_stat_');
    expect(noSpend.secondaryLabelKey).toContain('dashboard.checkin_stat_');
    expect(outing.secondaryLabelKey).toBeNull();
  });

  it('planCheckInDay clamps an already-over (negative) day to zeros', () => {
    const calm = planCheckInDay('calm', -500);
    expect(calm.primaryCents).toBe(0);
    expect(calm.secondaryCents).toBe(0);
    // A no-spend day on an already-over budget still saves nothing extra.
    const noSpend = planCheckInDay('no_spend', -500);
    expect(noSpend.primaryCents).toBe(0);
    expect(noSpend.secondaryCents).toBe(0);
  });

  describe('projectDailyBoostCents (G5 — saving today lifts later days)', () => {
    it('spreads the saved amount across the days still ahead', () => {
      // Save €40,00 with 4 effective days left after today → +€10,00/day.
      expect(projectDailyBoostCents(4000, 4)).toBe(1000);
      // €100,00 over 3 days rounds to the nearest cent-per-day.
      expect(projectDailyBoostCents(10000, 3)).toBe(3333);
    });

    it('omits the boost when nothing was saved or no days remain', () => {
      expect(projectDailyBoostCents(0, 5)).toBeNull();
      expect(projectDailyBoostCents(-100, 5)).toBeNull();
      // Last day of the phase: nothing ahead to lift.
      expect(projectDailyBoostCents(5000, 0)).toBeNull();
      expect(projectDailyBoostCents(5000, 0.5)).toBeNull();
    });

    it('never shows a sub-cent "+€0/day" line', () => {
      // €0,02 saved over 5 days → < 1 cent/day → omitted.
      expect(projectDailyBoostCents(2, 5)).toBeNull();
    });
  });
});
