import { describe, it, expect } from 'vitest';
import {
  createPhase,
  validatePhaseSequence,
  findOverlappingPhases,
  phaseRangesOverlap,
} from '@/domain/phases';
import type { Phase } from '@/domain/types/phase';

const mkPhase = (
  id: string,
  startDate: string,
  endDate: string,
  over: Partial<Phase> = {},
): Phase => ({
  ...createPhase({ tripId: 'trip-1', name: id, startDate, endDate, order: 0 }),
  id,
  ...over,
});

// The canonical trip (master §2): Burgos 06/06–15/07 · Eurotrip 16/07–04/08.
const burgos = mkPhase('burgos', '2026-06-06', '2026-07-15');
const eurotrip = mkPhase('eurotrip', '2026-07-16', '2026-08-04');

describe('phaseRangesOverlap (GATE 2 M2.3 — inclusive day ranges)', () => {
  it('true when the ranges share at least one day', () => {
    expect(phaseRangesOverlap('2026-06-06', '2026-07-15', '2026-07-15', '2026-08-04')).toBe(true);
    expect(phaseRangesOverlap('2026-06-06', '2026-07-20', '2026-07-10', '2026-07-12')).toBe(true);
  });
  it('false when the ranges are strictly sequential', () => {
    expect(phaseRangesOverlap('2026-06-06', '2026-07-15', '2026-07-16', '2026-08-04')).toBe(false);
  });
});

describe('findOverlappingPhases (GATE 2 M2.3)', () => {
  it('excludes the candidate itself when editing', () => {
    const phases = [burgos, eurotrip];
    const conflicts = findOverlappingPhases(phases, {
      id: 'eurotrip',
      startDate: '2026-07-16',
      endDate: '2026-08-10',
    });
    expect(conflicts).toHaveLength(0);
  });

  it('ignores soft-deleted phases', () => {
    const deleted = mkPhase('old', '2026-07-01', '2026-07-31', {
      deletedAt: '2026-05-01T00:00:00.000Z',
    });
    const conflicts = findOverlappingPhases([deleted], {
      startDate: '2026-07-10',
      endDate: '2026-07-20',
    });
    expect(conflicts).toHaveLength(0);
  });
});

describe('validatePhaseSequence (GATE 2 M2.3 — D12 sequential + D13 boundary day)', () => {
  it('accepts a clean sequential range', () => {
    expect(validatePhaseSequence([burgos], { startDate: '2026-07-16', endDate: '2026-08-04' })).toEqual({
      ok: true,
    });
  });

  it('rejects an inverted range (end before start)', () => {
    expect(
      validatePhaseSequence([], { startDate: '2026-07-16', endDate: '2026-07-10' }),
    ).toEqual({ ok: false, reason: 'invalid_range' });
  });

  it('D13: a new trecho starting on the boundary day trims the previous one to the day before', () => {
    // Eurotrip is set to START on 15/07 — the day Burgos currently ends. The
    // boundary day belongs to the trecho that STARTS, so Burgos must end 14/07.
    const result = validatePhaseSequence([burgos], {
      startDate: '2026-07-15',
      endDate: '2026-08-04',
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'overlap') throw new Error('expected overlap');
    expect(result.conflicts.map((p) => p.id)).toEqual(['burgos']);
    expect(result.boundaryFix).toEqual({
      phaseId: 'burgos',
      phaseName: 'burgos',
      newEndDate: '2026-07-14',
    });
  });

  it('the boundary fix, once applied, removes the overlap', () => {
    const fixedBurgos = mkPhase('burgos', '2026-06-06', '2026-07-14');
    expect(
      validatePhaseSequence([fixedBurgos], { startDate: '2026-07-15', endDate: '2026-08-04' }),
    ).toEqual({ ok: true });
  });

  it('offers NO auto-fix when the new trecho is carved inside another (would lose its tail)', () => {
    const long = mkPhase('long', '2026-06-01', '2026-08-31');
    const result = validatePhaseSequence([long], {
      startDate: '2026-07-10',
      endDate: '2026-07-20',
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'overlap') throw new Error('expected overlap');
    expect(result.boundaryFix).toBeNull();
  });

  it('offers NO auto-fix when more than one trecho conflicts', () => {
    const result = validatePhaseSequence([burgos, eurotrip], {
      startDate: '2026-07-10',
      endDate: '2026-07-20',
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'overlap') throw new Error('expected overlap');
    expect(result.conflicts.map((p) => p.id).sort()).toEqual(['burgos', 'eurotrip']);
    expect(result.boundaryFix).toBeNull();
  });

  it('offers NO auto-fix when the two trechos share the same start day (ambiguous)', () => {
    const result = validatePhaseSequence([burgos], {
      startDate: '2026-06-06',
      endDate: '2026-06-20',
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'overlap') throw new Error('expected overlap');
    expect(result.boundaryFix).toBeNull();
  });
});
