import { describe, it, expect } from 'vitest';
import { selectVisiblePots, isPotVisibleOnHome } from '@/domain/budget';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Phase } from '@/domain/types/phase';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

function mkPhase(id: string, startDate: string, endDate: string): Phase {
  return {
    ...meta,
    id,
    tripId: 'trip-1',
    name: id,
    startDate,
    endDate,
    order: 0,
    rhythmPreset: null,
    peakDays: null,
    notes: null,
  };
}

function mkPot(
  id: string,
  extra: Partial<Pick<BudgetPool, 'dateStart' | 'dateEnd' | 'goalCents' | 'scope' | 'deletedAt'>> = {},
): BudgetPool {
  return {
    ...meta,
    id,
    tripId: 'trip-1',
    name: id,
    scope: 'global',
    totalAmountCents: 20000,
    currency: 'EUR',
    notes: null,
    dateStart: null,
    dateEnd: null,
    goalCents: null,
    ...extra,
  };
}

// Canonical Europa 2026 trip (master §2).
const burgos = mkPhase('burgos', '2026-06-06', '2026-07-15');
const eurotrip = mkPhase('eurotrip', '2026-07-16', '2026-08-04');
const tomorrowland = mkPot('tomorrowland', { dateStart: '2026-07-23', dateEnd: '2026-07-26' });

describe('selectVisiblePots (GATE 3 / D8)', () => {
  it('hides a dated pot while its owner trecho is not active and the window is closed (Tomorrowland in Burgos)', () => {
    // June, traveler is in Burgos — Tomorrowland (23/07, owned by Eurotrip) must
    // NOT pollute the Home.
    expect(selectVisiblePots([tomorrowland], burgos, '2026-06-20')).toEqual([]);
    expect(isPotVisibleOnHome(tomorrowland, burgos, '2026-06-20')).toBe(false);
  });

  it('shows a dated pot when its owner trecho becomes active (Tomorrowland in Eurotrip)', () => {
    // 16/07: traveler enters the Eurotrip — Tomorrowland rises even though it is
    // a week away, because the owner trecho is now active.
    expect(selectVisiblePots([tomorrowland], eurotrip, '2026-07-16')).toEqual([tomorrowland]);
  });

  it('shows a dated pot inside the D-7 window even outside its owner trecho', () => {
    // No active phase, but today is exactly 7 days before the date → window open.
    expect(selectVisiblePots([tomorrowland], null, '2026-07-16')).toEqual([tomorrowland]);
    // 8 days before → still closed.
    expect(selectVisiblePots([tomorrowland], null, '2026-07-15')).toEqual([]);
  });

  it('closes the window after the pot end date', () => {
    // During the event days it is visible…
    expect(isPotVisibleOnHome(tomorrowland, null, '2026-07-25')).toBe(true);
    // …and the day after the end date (with no owner active) it drops off.
    expect(isPotVisibleOnHome(tomorrowland, null, '2026-07-27')).toBe(false);
  });

  it('keeps a DATELESS pot ambient (always on the Home — no regression)', () => {
    const shopping = mkPot('shopping'); // no date
    expect(selectVisiblePots([shopping], burgos, '2026-06-20')).toEqual([shopping]);
    expect(selectVisiblePots([shopping], eurotrip, '2026-12-31')).toEqual([shopping]);
  });

  it('excludes soft-deleted pots and non-global pools', () => {
    const deleted = mkPot('deleted', { deletedAt: '2026-06-01T00:00:00.000Z' });
    const trechoPool = mkPot('trecho-pool', { scope: 'linked_phases' });
    expect(selectVisiblePots([deleted, trechoPool], burgos, '2026-06-20')).toEqual([]);
  });

  it('returns the relevant subset and preserves order with several pots', () => {
    const shopping = mkPot('shopping');
    const emergency = mkPot('emergency'); // dateless → ambient
    // Mixed list: ambient pots always in; Tomorrowland only in its window.
    const inBurgos = selectVisiblePots([shopping, tomorrowland, emergency], burgos, '2026-06-20');
    expect(inBurgos.map((p) => p.id)).toEqual(['shopping', 'emergency']);

    const inEurotrip = selectVisiblePots([shopping, tomorrowland, emergency], eurotrip, '2026-07-23');
    expect(inEurotrip.map((p) => p.id)).toEqual(['shopping', 'tomorrowland', 'emergency']);
  });

  it('respects a custom window length', () => {
    // With a 3-day window, 7 days out is closed; owner trecho still wins.
    expect(isPotVisibleOnHome(tomorrowland, null, '2026-07-16', 3)).toBe(false);
    expect(isPotVisibleOnHome(tomorrowland, null, '2026-07-20', 3)).toBe(true);
  });
});
