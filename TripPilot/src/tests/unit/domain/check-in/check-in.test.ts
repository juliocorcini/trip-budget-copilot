import { describe, it, expect } from 'vitest';
import {
  getActiveCheckIn,
  createDailyCheckIn,
  shouldPromptCheckIn,
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
});
