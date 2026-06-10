import { describe, it, expect } from 'vitest';
import {
  createPlannedOccurrence,
  isOccurrenceActiveToday,
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
