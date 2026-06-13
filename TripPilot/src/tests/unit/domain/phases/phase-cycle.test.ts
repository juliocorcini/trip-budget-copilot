import { describe, it, expect } from 'vitest';
import {
  createPhase,
  findEndedPhaseWithSuccessor,
  detectPhaseLeftover,
  markPhaseLeftoverHandled,
} from '@/domain/phases';

function mkPhase(name: string, startDate: string, endDate: string, order: number) {
  return createPhase({ tripId: 'trip-1', name, startDate, endDate, order });
}

// Lisbon (1-5) → Eurotrip (6-12) → Porto (13-18)
const lisbon = mkPhase('Lisbon', '2026-06-01', '2026-06-05', 1);
const eurotrip = mkPhase('Eurotrip', '2026-06-06', '2026-06-12', 2);
const porto = mkPhase('Porto', '2026-06-13', '2026-06-18', 3);

describe('findEndedPhaseWithSuccessor (M9)', () => {
  it('returns the just-ended phase and its live successor', () => {
    const t = findEndedPhaseWithSuccessor([lisbon, eurotrip], '2026-06-08');
    expect(t?.ended.id).toBe(lisbon.id);
    expect(t?.next.id).toBe(eurotrip.id);
  });

  it('returns null while still inside the first phase (nothing ended)', () => {
    expect(findEndedPhaseWithSuccessor([lisbon, eurotrip], '2026-06-03')).toBeNull();
  });

  it('returns null for a single-phase trip', () => {
    expect(findEndedPhaseWithSuccessor([lisbon], '2026-06-09')).toBeNull();
  });

  it('picks the LATEST ended boundary across three phases', () => {
    const t = findEndedPhaseWithSuccessor([lisbon, eurotrip, porto], '2026-06-15');
    expect(t?.ended.id).toBe(eurotrip.id);
    expect(t?.next.id).toBe(porto.id);
  });

  it('returns null when the whole trip is over (no live successor)', () => {
    expect(findEndedPhaseWithSuccessor([lisbon, eurotrip], '2026-06-20')).toBeNull();
  });

  it('treats the end day itself as still active (inclusive)', () => {
    // On Lisbon's last day it has NOT ended yet.
    expect(findEndedPhaseWithSuccessor([lisbon, eurotrip], '2026-06-05')).toBeNull();
  });
});

describe('detectPhaseLeftover (M9)', () => {
  const phases = [lisbon, eurotrip];

  it('surfaces a positive leftover for an ended, unhandled phase', () => {
    const leftover = detectPhaseLeftover({
      phases,
      todayIso: '2026-06-08',
      leftoverCents: 12_000,
      handledPhaseIds: [],
    });
    expect(leftover).toEqual({
      endedPhaseId: lisbon.id,
      endedPhaseName: 'Lisbon',
      nextPhaseId: eurotrip.id,
      nextPhaseName: 'Eurotrip',
      leftoverCents: 12_000,
    });
  });

  it('returns null when there is no leftover', () => {
    expect(
      detectPhaseLeftover({ phases, todayIso: '2026-06-08', leftoverCents: 0, handledPhaseIds: [] }),
    ).toBeNull();
  });

  it('returns null once the phase has been handled (dismiss does not repeat)', () => {
    expect(
      detectPhaseLeftover({
        phases,
        todayIso: '2026-06-08',
        leftoverCents: 12_000,
        handledPhaseIds: [lisbon.id],
      }),
    ).toBeNull();
  });

  it('returns null when no phase has ended yet', () => {
    expect(
      detectPhaseLeftover({
        phases,
        todayIso: '2026-06-03',
        leftoverCents: 12_000,
        handledPhaseIds: [],
      }),
    ).toBeNull();
  });
});

describe('markPhaseLeftoverHandled (M9)', () => {
  it('appends a new id', () => {
    expect(markPhaseLeftoverHandled([], 'p1')).toEqual(['p1']);
    expect(markPhaseLeftoverHandled(['p0'], 'p1')).toEqual(['p0', 'p1']);
  });

  it('is idempotent — never duplicates', () => {
    expect(markPhaseLeftoverHandled(['p1'], 'p1')).toEqual(['p1']);
  });
});
