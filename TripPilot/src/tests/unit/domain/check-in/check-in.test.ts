import { describe, it, expect } from 'vitest';
import {
  getActiveCheckIn,
  createDailyCheckIn,
  shouldPromptCheckIn,
  planCheckInDay,
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

  it('the intent catalog covers the three intents with icons + labels', () => {
    expect(CHECK_IN_INTENT_CATALOG.map((c) => c.intent)).toEqual(['calm', 'outing', 'night']);
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

    // Distinct messages + icons — picking a mode visibly changes the result.
    const messageKeys = new Set([calm.messageKey, outing.messageKey, night.messageKey]);
    expect(messageKeys.size).toBe(3);

    // Calm proposes a LIGHT target (spend less); the rest becomes slack.
    expect(calm.primaryCents).toBe(6000);
    expect(calm.secondaryCents).toBe(4000);
    // Outing uses the FULL amount, no split.
    expect(outing.primaryCents).toBe(free);
    expect(outing.secondaryCents).toBeNull();
    // Night reserves half for the night, the rest for earlier.
    expect(night.primaryCents).toBe(5000);
    expect(night.secondaryCents).toBe(5000);

    // The two parts always reconstruct the honest free-today (read-only).
    expect(calm.primaryCents + (calm.secondaryCents ?? 0)).toBe(free);
    expect(night.primaryCents + (night.secondaryCents ?? 0)).toBe(free);
    // The headline numbers genuinely differ across modes (not the same value).
    expect(new Set([calm.primaryCents, outing.primaryCents, night.primaryCents]).size).toBe(3);
  });

  it('planCheckInDay clamps an already-over (negative) day to zeros', () => {
    const calm = planCheckInDay('calm', -500);
    expect(calm.primaryCents).toBe(0);
    expect(calm.secondaryCents).toBe(0);
  });
});
