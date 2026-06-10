import { describe, it, expect } from 'vitest';
import { createPhase, getNextPhaseOrder } from '@/domain/phases';
import type { Phase } from '@/domain/types/phase';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null as string | null,
  revision: 1,
  sourceDeviceId: 'test',
};

const mkPhase = (id: string, order: number, deletedAt: string | null = null): Phase => ({
  ...meta,
  id,
  tripId: 'trip-1',
  name: `Phase ${order}`,
  startDate: '2026-06-01',
  endDate: '2026-06-10',
  order,
  rhythmPreset: null,
  peakDays: null,
  notes: null,
  deletedAt,
});

describe('createPhase', () => {
  it('creates a phase with the provided fields', () => {
    const phase = createPhase({
      tripId: 'trip-1',
      name: 'Madrid',
      startDate: '2026-07-01',
      endDate: '2026-07-15',
      order: 2,
    });
    expect(phase.tripId).toBe('trip-1');
    expect(phase.name).toBe('Madrid');
    expect(phase.startDate).toBe('2026-07-01');
    expect(phase.endDate).toBe('2026-07-15');
    expect(phase.order).toBe(2);
    expect(phase.deletedAt).toBeNull();
    expect(phase.id).toBeTruthy();
  });
});

describe('getNextPhaseOrder', () => {
  it('returns 0 for an empty list', () => {
    expect(getNextPhaseOrder([])).toBe(0);
  });

  it('returns max order + 1', () => {
    const phases = [mkPhase('p1', 0), mkPhase('p2', 1), mkPhase('p3', 4)];
    expect(getNextPhaseOrder(phases)).toBe(5);
  });

  it('ignores soft-deleted phases', () => {
    const phases = [mkPhase('p1', 0), mkPhase('p2', 7, '2026-01-02T00:00:00.000Z')];
    expect(getNextPhaseOrder(phases)).toBe(1);
  });
});
