import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  findActivePhase,
  getDayNumber,
  getDaysRemaining,
  getTotalDays,
  formatDate,
  sortPhasesByOrder,
  toSafeIsoDate,
} from '@/domain/dates';
import type { Phase } from '@/domain/types/phase';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const phases: Phase[] = [
  { ...baseMeta, id: 'p1', tripId: 'trip-1', name: 'Phase 1', startDate: '2026-07-01', endDate: '2026-07-15', order: 0, rhythmPreset: null, peakDays: null, notes: null },
  { ...baseMeta, id: 'p2', tripId: 'trip-1', name: 'Phase 2', startDate: '2026-07-16', endDate: '2026-07-31', order: 1, rhythmPreset: null, peakDays: null, notes: null },
];

describe('findActivePhase', () => {
  it('finds phase containing reference date', () => {
    const ref = parseISO('2026-07-10');
    const result = findActivePhase(phases, ref);
    expect(result?.id).toBe('p1');
  });

  it('returns null when no phase matches', () => {
    const ref = parseISO('2026-08-01');
    expect(findActivePhase(phases, ref)).toBeNull();
  });

  it('ignores deleted phases', () => {
    const deleted = [{ ...phases[0]!, deletedAt: '2026-01-01T00:00:00.000Z' }, phases[1]!];
    const ref = parseISO('2026-07-10');
    expect(findActivePhase(deleted, ref)).toBeNull();
  });
});

describe('getDayNumber', () => {
  it('returns 1 on start date', () => {
    expect(getDayNumber('2026-07-01', parseISO('2026-07-01'))).toBe(1);
  });

  it('returns correct day in middle', () => {
    expect(getDayNumber('2026-07-01', parseISO('2026-07-10'))).toBe(10);
  });
});

describe('getDaysRemaining', () => {
  it('returns days until end date', () => {
    expect(getDaysRemaining('2026-07-15', parseISO('2026-07-10'))).toBe(5);
  });

  it('returns 0 after end date', () => {
    expect(getDaysRemaining('2026-07-15', parseISO('2026-07-20'))).toBe(0);
  });
});

describe('getTotalDays', () => {
  it('counts inclusive days', () => {
    expect(getTotalDays('2026-07-01', '2026-07-15')).toBe(15);
  });
});

describe('formatDate', () => {
  it('formats to dd/MM/yyyy', () => {
    expect(formatDate('2026-07-01')).toBe('01/07/2026');
  });
});

describe('sortPhasesByOrder', () => {
  it('sorts by order ascending', () => {
    const reversed = [...phases].reverse();
    const sorted = sortPhasesByOrder(reversed);
    expect(sorted[0]!.order).toBe(0);
    expect(sorted[1]!.order).toBe(1);
  });
});

describe('toSafeIsoDate (BUG-016)', () => {
  it('converts a valid datetime-local value to ISO', () => {
    expect(toSafeIsoDate('2026-06-13T20:30')).toBe(new Date('2026-06-13T20:30').toISOString());
  });

  it('never throws on a corrupted value and falls back to a valid ISO string', () => {
    expect(() => toSafeIsoDate('not-a-date')).not.toThrow();
    const result = toSafeIsoDate('not-a-date');
    expect(() => new Date(result).toISOString()).not.toThrow();
    expect(Number.isNaN(new Date(result).getTime())).toBe(false);
  });
});
