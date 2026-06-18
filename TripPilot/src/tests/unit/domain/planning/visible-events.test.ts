import { describe, it, expect } from 'vitest';
import { selectVisibleEvents, isEventVisibleOnHome } from '@/domain/planning';
import type { Phase } from '@/domain/types/phase';
import type { PlannedOccurrence, OccurrenceKind } from '@/domain/types/planned-occurrence';

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

function mkEvent(
  id: string,
  plannedDate: string | null,
  extra: Partial<
    Pick<PlannedOccurrence, 'endDate' | 'kind' | 'isConfirmed' | 'linkedSessionId' | 'deletedAt'>
  > = {},
): PlannedOccurrence {
  return {
    ...meta,
    id,
    tripId: 'trip-1',
    phaseId: 'eurotrip',
    activityProfileId: null,
    budgetPoolId: 'pool-1',
    name: id,
    plannedDate,
    endDate: null,
    kind: 'event' as OccurrenceKind,
    estimatedCostCents: 20000,
    reservedCents: null,
    isConfirmed: false,
    linkedTransactionId: null,
    linkedSessionId: null,
    notes: null,
    ...extra,
  };
}

// Canonical Europa 2026 trip (master §2).
const burgos = mkPhase('burgos', '2026-06-06', '2026-07-15');
const eurotrip = mkPhase('eurotrip', '2026-07-16', '2026-08-04');
const tomorrowland = mkEvent('tomorrowland', '2026-07-23', { endDate: '2026-07-26' });

describe('selectVisibleEvents (GATE 4 M4.4 / D8 — mirrors the pot rule)', () => {
  it('hides an event while its owner trecho is not active and the window is closed (Tomorrowland in Burgos)', () => {
    expect(selectVisibleEvents([tomorrowland], burgos, '2026-06-20')).toEqual([]);
    expect(isEventVisibleOnHome(tomorrowland, burgos, '2026-06-20')).toBe(false);
  });

  it('shows an event when its owner trecho becomes active (Tomorrowland in Eurotrip)', () => {
    expect(selectVisibleEvents([tomorrowland], eurotrip, '2026-07-16')).toEqual([tomorrowland]);
  });

  it('shows an event inside the D-7 window even with no active phase', () => {
    expect(selectVisibleEvents([tomorrowland], null, '2026-07-16')).toEqual([tomorrowland]);
    // 8 days before → still closed.
    expect(selectVisibleEvents([tomorrowland], null, '2026-07-15')).toEqual([]);
  });

  it('closes the window after the event end date', () => {
    expect(isEventVisibleOnHome(tomorrowland, null, '2026-07-26')).toBe(true);
    expect(isEventVisibleOnHome(tomorrowland, null, '2026-07-27')).toBe(false);
  });

  it('drops dateless, soft-deleted, confirmed, linked, and non-event occurrences', () => {
    expect(isEventVisibleOnHome(mkEvent('dateless', null), eurotrip, '2026-07-20')).toBe(false);
    expect(
      isEventVisibleOnHome(mkEvent('deleted', '2026-07-20', { deletedAt: meta.createdAt }), eurotrip, '2026-07-20'),
    ).toBe(false);
    expect(
      isEventVisibleOnHome(mkEvent('done', '2026-07-20', { isConfirmed: true }), eurotrip, '2026-07-20'),
    ).toBe(false);
    expect(
      isEventVisibleOnHome(mkEvent('live', '2026-07-20', { linkedSessionId: 'sess-1' }), eurotrip, '2026-07-20'),
    ).toBe(false);
    expect(
      isEventVisibleOnHome(mkEvent('city', '2026-07-20', { kind: 'sub_destination' }), eurotrip, '2026-07-20'),
    ).toBe(false);
  });

  it('returns the relevant subset, sorted chronologically', () => {
    const early = mkEvent('early', '2026-07-18');
    const late = mkEvent('late', '2026-07-30');
    const result = selectVisibleEvents([late, tomorrowland, early], eurotrip, '2026-07-16');
    // Owner trecho active → all three visible, sorted by date.
    expect(result.map((e) => e.id)).toEqual(['early', 'tomorrowland', 'late']);
  });

  it('respects a custom window length', () => {
    expect(isEventVisibleOnHome(tomorrowland, null, '2026-07-16', 3)).toBe(false);
    expect(isEventVisibleOnHome(tomorrowland, null, '2026-07-20', 3)).toBe(true);
  });
});
