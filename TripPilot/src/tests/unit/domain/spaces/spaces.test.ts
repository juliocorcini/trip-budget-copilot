import { describe, it, expect } from 'vitest';
import {
  groupSpaces,
  tripKind,
  isOngoing,
  countSpaces,
  spaceCapabilities,
  monthlyCapStatus,
} from '@/domain/spaces/spaces';
import type { Trip } from '@/domain/types/trip';
import type { TripStatus, TripKind } from '@/domain/types/common';

function makeTrip(
  overrides: Partial<Trip> & { id: string; status: TripStatus },
): Trip {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 1,
    sourceDeviceId: 'dev-1',
    name: overrides.id,
    baseCurrency: 'BRL',
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    notes: null,
    ...overrides,
  };
}

describe('tripKind / isOngoing', () => {
  it('treats a record without `kind` as a regular trip (no migration)', () => {
    const legacy = makeTrip({ id: 'legacy', status: 'active' });
    expect(legacy.kind).toBeUndefined();
    expect(tripKind(legacy)).toBe('trip');
    expect(isOngoing(legacy)).toBe(false);
  });

  it('honors an explicit kind', () => {
    const ongoing = makeTrip({ id: 'home', status: 'active', kind: 'ongoing' as TripKind });
    expect(tripKind(ongoing)).toBe('ongoing');
    expect(isOngoing(ongoing)).toBe(true);
  });
});

describe('groupSpaces', () => {
  it('orders groups ongoing → active → planning → completed and drops empty ones', () => {
    const trips = [
      makeTrip({ id: 'done', status: 'completed' }),
      makeTrip({ id: 'soon', status: 'planning' }),
      makeTrip({ id: 'now', status: 'active' }),
      makeTrip({ id: 'daily', status: 'active', kind: 'ongoing' }),
    ];
    const groups = groupSpaces(trips);
    expect(groups.map((g) => g.id)).toEqual(['ongoing', 'active', 'planning', 'completed']);
    // an ongoing space with status 'active' must NOT leak into the active trips
    // group — it belongs only to "Dia a dia".
    expect(groups.find((g) => g.id === 'ongoing')?.spaces.map((s) => s.id)).toEqual(['daily']);
    expect(groups.find((g) => g.id === 'active')?.spaces.map((s) => s.id)).toEqual(['now']);
  });

  it('omits the ongoing group entirely when there are no ongoing spaces', () => {
    const trips = [makeTrip({ id: 'now', status: 'active' })];
    const groups = groupSpaces(trips);
    expect(groups.map((g) => g.id)).toEqual(['active']);
  });

  it('excludes soft-deleted spaces from every group', () => {
    const trips = [
      makeTrip({ id: 'live', status: 'active' }),
      makeTrip({ id: 'gone', status: 'active', deletedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const groups = groupSpaces(trips);
    expect(groups).toHaveLength(1);
    expect(groups.find((g) => g.id === 'active')?.spaces.map((s) => s.id)).toEqual(['live']);
  });

  it('sorts spaces within a group by most-recently-updated first', () => {
    const trips = [
      makeTrip({ id: 'older', status: 'planning', updatedAt: '2026-03-01T00:00:00.000Z' }),
      makeTrip({ id: 'newer', status: 'planning', updatedAt: '2026-06-01T00:00:00.000Z' }),
      makeTrip({ id: 'middle', status: 'planning', updatedAt: '2026-04-15T00:00:00.000Z' }),
    ];
    const groups = groupSpaces(trips);
    expect(groups.find((g) => g.id === 'planning')?.spaces.map((s) => s.id)).toEqual([
      'newer',
      'middle',
      'older',
    ]);
  });
});

describe('countSpaces', () => {
  it('counts only non-deleted spaces', () => {
    const trips = [
      makeTrip({ id: 'a', status: 'active' }),
      makeTrip({ id: 'b', status: 'planning' }),
      makeTrip({ id: 'c', status: 'completed', deletedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(countSpaces(trips)).toBe(2);
  });
});

describe('spaceCapabilities (DEC-251 gate)', () => {
  it('a dated trip exposes countdown/phases/daily budget, no monthly cap', () => {
    const caps = spaceCapabilities(makeTrip({ id: 'trip', status: 'active' }));
    expect(caps).toEqual({
      hasEndDate: true,
      hasPhases: true,
      hasDailyBudget: true,
      hasMonthlyBudget: false,
    });
  });

  it('an ongoing space hides every date-coupled capability and gains the monthly cap', () => {
    const caps = spaceCapabilities(makeTrip({ id: 'home', status: 'active', kind: 'ongoing' }));
    expect(caps).toEqual({
      hasEndDate: false,
      hasPhases: false,
      hasDailyBudget: false,
      hasMonthlyBudget: true,
    });
  });

  it('treats a legacy trip (no kind) as a dated trip', () => {
    const caps = spaceCapabilities(makeTrip({ id: 'legacy', status: 'completed' }));
    expect(caps.hasPhases).toBe(true);
    expect(caps.hasMonthlyBudget).toBe(false);
  });
});

describe('monthlyCapStatus (DEC-251 — optional monthly cap)', () => {
  it('reports no cap when the cap is 0 (open, just logging)', () => {
    expect(monthlyCapStatus(5_000, 0)).toEqual({
      hasCap: false,
      remainingCents: 0,
      isOver: false,
      pct: 0,
    });
  });

  it('computes remaining and a clamped percentage under the cap', () => {
    // €30 spent of a €100 cap → €70 left, 30%.
    expect(monthlyCapStatus(3_000, 10_000)).toEqual({
      hasCap: true,
      remainingCents: 7_000,
      isOver: false,
      pct: 30,
    });
  });

  it('flags over-budget with a negative remaining and a bar pinned at 100%', () => {
    // €120 spent of a €100 cap → −€20, over, bar clamped to 100%.
    expect(monthlyCapStatus(12_000, 10_000)).toEqual({
      hasCap: true,
      remainingCents: -2_000,
      isOver: true,
      pct: 100,
    });
  });

  it('is exactly at the cap (0 left, 100%, not over)', () => {
    expect(monthlyCapStatus(10_000, 10_000)).toEqual({
      hasCap: true,
      remainingCents: 0,
      isOver: false,
      pct: 100,
    });
  });

  it('never returns a negative percentage when spend is below zero (net credit)', () => {
    const status = monthlyCapStatus(-500, 10_000);
    expect(status.pct).toBe(0);
    expect(status.remainingCents).toBe(10_500);
  });
});
