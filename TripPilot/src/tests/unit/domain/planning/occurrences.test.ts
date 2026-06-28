import { describe, it, expect } from 'vitest';
import {
  createPlannedOccurrence,
  isOccurrenceActiveToday,
  isWithinOccurrenceInterval,
  isEventInProgress,
  selectAttributableEvents,
  selectActiveEventsInProgress,
  postponeOccurrence,
  sumSpentInOccurrenceInterval,
} from '@/domain/planning';

function mkOccurrence(overrides: Partial<Parameters<typeof createPlannedOccurrence>[0]> = {}) {
  return createPlannedOccurrence({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    name: 'Parral',
    plannedDate: '2026-06-12',
    endDate: null,
    kind: 'event',
    estimatedCostCents: 5000,
    reservedCents: 5000,
    activityProfileId: null,
    ...overrides,
  });
}

describe('createPlannedOccurrence (DEC-072)', () => {
  it('creates an unconfirmed event with no links', () => {
    const occ = mkOccurrence();
    expect(occ.isConfirmed).toBe(false);
    expect(occ.linkedSessionId).toBeNull();
    expect(occ.linkedTransactionId).toBeNull();
    expect(occ.kind).toBe('event');
    expect(occ.reservedCents).toBe(5000);
    expect(occ.deletedAt).toBeNull();
  });
});

describe('isOccurrenceActiveToday (day card rule)', () => {
  it('is active on the planned date when not linked/confirmed', () => {
    const occ = mkOccurrence();
    expect(isOccurrenceActiveToday(occ, '2026-06-12T10:00:00.000Z')).toBe(true);
    expect(isOccurrenceActiveToday(occ, '2026-06-11T10:00:00.000Z')).toBe(false);
    expect(isOccurrenceActiveToday(occ, '2026-06-13T10:00:00.000Z')).toBe(false);
  });

  it('covers the whole interval for multi-day events', () => {
    const occ = mkOccurrence({ endDate: '2026-06-14' });
    expect(isOccurrenceActiveToday(occ, '2026-06-13T10:00:00.000Z')).toBe(true);
    expect(isOccurrenceActiveToday(occ, '2026-06-14T23:00:00.000Z')).toBe(true);
    expect(isOccurrenceActiveToday(occ, '2026-06-15T01:00:00.000Z')).toBe(false);
  });

  it('disappears once a session is linked or the occurrence confirmed', () => {
    const linked = { ...mkOccurrence(), linkedSessionId: 's1' };
    const confirmed = { ...mkOccurrence(), isConfirmed: true };
    expect(isOccurrenceActiveToday(linked, '2026-06-12T10:00:00.000Z')).toBe(false);
    expect(isOccurrenceActiveToday(confirmed, '2026-06-12T10:00:00.000Z')).toBe(false);
  });
});

describe('postponeOccurrence ("Adiar" +1 day)', () => {
  it('shifts a single-day event by one day', () => {
    const occ = postponeOccurrence(mkOccurrence());
    expect(occ.plannedDate).toBe('2026-06-13');
    expect(occ.endDate).toBeNull();
  });

  it('shifts the whole interval of a multi-day event', () => {
    const occ = postponeOccurrence(mkOccurrence({ endDate: '2026-06-14' }));
    expect(occ.plannedDate).toBe('2026-06-13');
    expect(occ.endDate).toBe('2026-06-15');
  });

  it('crosses month boundaries correctly', () => {
    const occ = postponeOccurrence(mkOccurrence({ plannedDate: '2026-06-30' }));
    expect(occ.plannedDate).toBe('2026-07-01');
  });
});

describe('sumSpentInOccurrenceInterval (sub-destinations)', () => {
  const tx = (date: string, cents: number, phaseId = 'phase-1') => ({
    date: `${date}T12:00:00.000Z`,
    phaseId,
    deletedAt: null as string | null,
    type: 'expense',
    personalCostCents: null as number | null,
    amountCents: cents,
  });

  it('sums only transactions inside the date interval and phase', () => {
    const occ = mkOccurrence({ plannedDate: '2026-06-10', endDate: '2026-06-12', kind: 'sub_destination' });
    const txs = [
      tx('2026-06-09', 1000), // before
      tx('2026-06-10', 2000), // inside
      tx('2026-06-12', 3000), // inside (last day)
      tx('2026-06-13', 4000), // after
      tx('2026-06-11', 5000, 'phase-2'), // other phase
    ];
    expect(sumSpentInOccurrenceInterval(occ, txs)).toBe(5000);
  });

  it('uses personal cost for shared expenses', () => {
    const occ = mkOccurrence({ plannedDate: '2026-06-10', endDate: '2026-06-12' });
    const shared = { ...tx('2026-06-11', 6000), personalCostCents: 2000 };
    expect(sumSpentInOccurrenceInterval(occ, [shared])).toBe(2000);
  });
});

describe('isWithinOccurrenceInterval (DEC-386 · date core)', () => {
  it('covers the inclusive interval, ignoring the link/confirmed state', () => {
    const occ = { ...mkOccurrence({ endDate: '2026-06-14' }), linkedSessionId: 's1', isConfirmed: true };
    expect(isWithinOccurrenceInterval(occ, '2026-06-12T10:00:00.000Z')).toBe(true);
    expect(isWithinOccurrenceInterval(occ, '2026-06-09T10:00:00.000Z')).toBe(false);
    expect(isWithinOccurrenceInterval(occ, '2026-06-15T10:00:00.000Z')).toBe(false);
  });

  it('is false for an undated occurrence', () => {
    expect(isWithinOccurrenceInterval(mkOccurrence({ plannedDate: null }), '2026-06-12')).toBe(false);
  });
});

describe('selectAttributableEvents (DEC-386 · G1 selector)', () => {
  it('returns open events whose interval contains the day, chronologically', () => {
    const a = mkOccurrence({ name: 'A', plannedDate: '2026-06-12' });
    const b = mkOccurrence({ name: 'B', plannedDate: '2026-06-10', endDate: '2026-06-13' });
    const result = selectAttributableEvents([a, b], '2026-06-12T15:00:00.000Z');
    expect(result.map((o) => o.name)).toEqual(['B', 'A']);
  });

  it('includes an event that already has a live outing session (decoupled)', () => {
    const linked = { ...mkOccurrence(), linkedSessionId: 's1' };
    expect(selectAttributableEvents([linked], '2026-06-12').map((o) => o.id)).toEqual([linked.id]);
  });

  it('excludes deleted, confirmed, off-interval and non-event occurrences', () => {
    const deleted = { ...mkOccurrence(), deletedAt: '2026-06-12T00:00:00.000Z' };
    const confirmed = { ...mkOccurrence(), isConfirmed: true };
    const offDay = mkOccurrence({ plannedDate: '2026-06-20' });
    const subDest = mkOccurrence({ kind: 'sub_destination' });
    const result = selectAttributableEvents(
      [deleted, confirmed, offDay, subDest],
      '2026-06-12T10:00:00.000Z',
    );
    expect(result).toEqual([]);
  });
});

// DEC-390 (parte 2, G1): the live-event Home block must keep showing an event
// that is HAPPENING even after its outing starts (the keystone bug: it used to
// vanish once `linkedSessionId` was set).
describe('isEventInProgress / selectActiveEventsInProgress (DEC-390 · G1)', () => {
  it('keeps an in-progress event visible even with a live outing session', () => {
    const linked = { ...mkOccurrence({ endDate: '2026-06-14' }), linkedSessionId: 's1' };
    expect(isEventInProgress(linked, '2026-06-13T10:00:00.000Z')).toBe(true);
    expect(
      selectActiveEventsInProgress([linked], '2026-06-13T10:00:00.000Z').map((o) => o.id),
    ).toEqual([linked.id]);
  });

  it('matches isOccurrenceActiveToday for a no-session event, but does NOT drop it once linked', () => {
    const open = mkOccurrence({ endDate: '2026-06-14' });
    const linked = { ...open, linkedSessionId: 's1' };
    const day = '2026-06-13T10:00:00.000Z';
    // No session: both rules agree it is active today.
    expect(isOccurrenceActiveToday(open, day)).toBe(true);
    expect(isEventInProgress(open, day)).toBe(true);
    // Once an outing is linked, the day-card rule drops it but the live rule keeps it.
    expect(isOccurrenceActiveToday(linked, day)).toBe(false);
    expect(isEventInProgress(linked, day)).toBe(true);
  });

  it('excludes deleted, confirmed, off-interval and non-event occurrences', () => {
    const deleted = { ...mkOccurrence(), deletedAt: '2026-06-12T00:00:00.000Z', linkedSessionId: 's1' };
    const confirmed = { ...mkOccurrence(), isConfirmed: true, linkedSessionId: 's1' };
    const offDay = { ...mkOccurrence({ plannedDate: '2026-06-20' }), linkedSessionId: 's1' };
    const subDest = { ...mkOccurrence({ kind: 'sub_destination' }), linkedSessionId: 's1' };
    expect(isEventInProgress(deleted, '2026-06-12')).toBe(false);
    expect(isEventInProgress(confirmed, '2026-06-12')).toBe(false);
    expect(isEventInProgress(offDay, '2026-06-12')).toBe(false);
    expect(isEventInProgress(subDest, '2026-06-12')).toBe(false);
    expect(
      selectActiveEventsInProgress([deleted, confirmed, offDay, subDest], '2026-06-12T10:00:00.000Z'),
    ).toEqual([]);
  });

  it('sorts the in-progress events chronologically by start', () => {
    const a = { ...mkOccurrence({ name: 'A', plannedDate: '2026-06-12' }), linkedSessionId: 's1' };
    const b = mkOccurrence({ name: 'B', plannedDate: '2026-06-10', endDate: '2026-06-13' });
    expect(
      selectActiveEventsInProgress([a, b], '2026-06-12T15:00:00.000Z').map((o) => o.name),
    ).toEqual(['B', 'A']);
  });
});
