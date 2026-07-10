import { describe, it, expect } from 'vitest';
import { buildAutoPlan } from '@/domain/planning/planning';

const makeProfile = (id: string, typicalValueCents: number) => ({
  id,
  typicalValueCents,
});

describe('buildAutoPlan', () => {
  it('returns empty when no profiles selected', () => {
    const result = buildAutoPlan({
      selectedProfileIds: [],
      profiles: [makeProfile('a', 3500)],
      freeToSpendCents: 100_000,
    });
    expect(result.allocations).toHaveLength(0);
    expect(result.totalAllocatedCents).toBe(0);
    expect(result.remainingFreeCents).toBe(100_000);
  });

  it('returns empty when freeToSpendCents is zero', () => {
    const result = buildAutoPlan({
      selectedProfileIds: ['a'],
      profiles: [makeProfile('a', 3500)],
      freeToSpendCents: 0,
    });
    expect(result.allocations).toHaveLength(0);
  });

  it('skips profiles with typicalValueCents <= 0', () => {
    const result = buildAutoPlan({
      selectedProfileIds: ['a', 'b'],
      profiles: [makeProfile('a', 0), makeProfile('b', 5000)],
      freeToSpendCents: 50_000,
    });
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.activityProfileId).toBe('b');
  });

  it('allocates proportionally with two equally-priced activities', () => {
    const result = buildAutoPlan({
      selectedProfileIds: ['a', 'b'],
      profiles: [makeProfile('a', 2000), makeProfile('b', 2000)],
      freeToSpendCents: 20_000,
    });
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]!.quantity).toBe(5);
    expect(result.allocations[1]!.quantity).toBe(5);
    expect(result.totalAllocatedCents).toBe(20_000);
  });

  it('allocates proportionally with different costs', () => {
    const result = buildAutoPlan({
      selectedProfileIds: ['cheap', 'expensive'],
      profiles: [makeProfile('cheap', 1000), makeProfile('expensive', 4000)],
      freeToSpendCents: 50_000,
    });
    expect(result.allocations[0]!.activityProfileId).toBe('cheap');
    expect(result.allocations[0]!.quantity).toBe(10);
    expect(result.allocations[1]!.activityProfileId).toBe('expensive');
    expect(result.allocations[1]!.quantity).toBe(10);
    expect(result.totalAllocatedCents).toBe(50_000);
  });

  it('guarantees minimum quantity of 1 per selected activity', () => {
    const result = buildAutoPlan({
      selectedProfileIds: ['a', 'b'],
      profiles: [makeProfile('a', 90_000), makeProfile('b', 10_000)],
      freeToSpendCents: 100_000,
    });
    expect(result.allocations[0]!.quantity).toBeGreaterThanOrEqual(1);
    expect(result.allocations[1]!.quantity).toBeGreaterThanOrEqual(1);
  });

  it('trims over-budget by reducing largest-cost items first', () => {
    const result = buildAutoPlan({
      selectedProfileIds: ['a', 'b'],
      profiles: [makeProfile('a', 40_000), makeProfile('b', 10_000)],
      freeToSpendCents: 50_000,
    });
    expect(result.totalAllocatedCents).toBeLessThanOrEqual(50_000);
    expect(result.remainingFreeCents).toBeGreaterThanOrEqual(0);
  });

  it('handles single activity within budget', () => {
    const result = buildAutoPlan({
      selectedProfileIds: ['x'],
      profiles: [makeProfile('x', 5000)],
      freeToSpendCents: 30_000,
    });
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.quantity).toBe(6);
    expect(result.totalAllocatedCents).toBe(30_000);
    expect(result.remainingFreeCents).toBe(0);
  });

  it('ignores IDs not found in profiles', () => {
    const result = buildAutoPlan({
      selectedProfileIds: ['missing', 'a'],
      profiles: [makeProfile('a', 2000)],
      freeToSpendCents: 10_000,
    });
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.activityProfileId).toBe('a');
  });
});
