import { describe, it, expect } from 'vitest';
import { calculateRecommendedFloor } from '@/domain/budget';
import { createPhase } from '@/domain/phases';

// B7 (DEC-016): the recommended future floor splits a pool across its linked
// phases by rhythm-weighted spending days, then offers three tiers. Uniform
// rhythm (rhythmPreset null) weights every day as 1, so effective days = the
// inclusive calendar-day count.

const phaseA = createPhase({
  tripId: 't',
  name: 'A',
  startDate: '2026-06-01',
  endDate: '2026-06-04', // 4 days
  order: 0,
});
const phaseB = createPhase({
  tripId: 't',
  name: 'B',
  startDate: '2026-06-05',
  endDate: '2026-06-12', // 8 days
  order: 1,
});

describe('calculateRecommendedFloor (B7 / DEC-016)', () => {
  it('splits the pool across linked phases by their spending days', () => {
    const rec = calculateRecommendedFloor({
      poolTotalCents: 120000,
      futurePhase: phaseB,
      linkedPhases: [phaseA, phaseB],
    });
    // €1200 × 8/12 = €800
    expect(rec.recommendedCents).toBe(80000);
    expect(rec.essentialCents).toBe(64000); // 0.8×
    expect(rec.comfortableCents).toBe(96000); // 1.2×
  });

  it('gives the shorter phase a proportionally smaller share', () => {
    const rec = calculateRecommendedFloor({
      poolTotalCents: 120000,
      futurePhase: phaseA,
      linkedPhases: [phaseA, phaseB],
    });
    // €1200 × 4/12 = €400
    expect(rec.recommendedCents).toBe(40000);
  });

  it('keeps the tiers ordered essential < recommended < comfortable', () => {
    const rec = calculateRecommendedFloor({
      poolTotalCents: 99999,
      futurePhase: phaseB,
      linkedPhases: [phaseA, phaseB],
    });
    expect(rec.essentialCents).toBeLessThan(rec.recommendedCents);
    expect(rec.recommendedCents).toBeLessThan(rec.comfortableCents);
  });

  it('returns zeros when the pool has no money', () => {
    const rec = calculateRecommendedFloor({
      poolTotalCents: 0,
      futurePhase: phaseB,
      linkedPhases: [phaseA, phaseB],
    });
    expect(rec).toEqual({ essentialCents: 0, recommendedCents: 0, comfortableCents: 0 });
  });

  it('returns zeros when there are no linked spending days', () => {
    const rec = calculateRecommendedFloor({
      poolTotalCents: 120000,
      futurePhase: phaseB,
      linkedPhases: [],
    });
    expect(rec.recommendedCents).toBe(0);
  });
});
