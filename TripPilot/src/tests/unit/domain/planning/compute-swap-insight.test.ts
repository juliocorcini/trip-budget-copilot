import { describe, it, expect } from 'vitest';
import { computeSwapInsight, type SwapAllocation } from '@/domain/planning/planning';

const alloc = (
  name: string,
  typicalCostCents: number,
  remaining: number,
  icon = 'local_bar',
): SwapAllocation => ({
  name,
  icon,
  typicalCostCents,
  remaining,
});

describe('computeSwapInsight (G3 / DEC-490)', () => {
  it('returns a valid swap when one activity costs much more than another', () => {
    const result = computeSwapInsight([
      alloc('Bar', 3500, 5),
      alloc('Market', 1000, 3),
    ]);
    expect(result).not.toBeNull();
    expect(result!.from.name).toBe('Bar');
    expect(result!.to.name).toBe('Market');
    expect(result!.gain).toBe(3);
  });

  it('returns null when fewer than 2 eligible allocations', () => {
    expect(computeSwapInsight([alloc('Bar', 3500, 5)])).toBeNull();
    expect(computeSwapInsight([])).toBeNull();
  });

  it('returns null when all activities have equal costs', () => {
    const result = computeSwapInsight([
      alloc('A', 2000, 5),
      alloc('B', 2000, 5),
    ]);
    expect(result).toBeNull();
  });

  it('returns null when gain < 2', () => {
    const result = computeSwapInsight([
      alloc('Expensive', 1500, 5),
      alloc('Cheap', 1000, 5),
    ]);
    expect(result).toBeNull();
  });

  it('respects the remaining threshold', () => {
    const below = computeSwapInsight([
      alloc('Bar', 3500, 1),
      alloc('Market', 1000, 1),
    ]);
    expect(below).toBeNull();

    const above = computeSwapInsight(
      [alloc('Bar', 3500, 1), alloc('Market', 1000, 1)],
      1,
    );
    expect(above).not.toBeNull();
  });

  it('picks the most expensive as from and cheapest as to', () => {
    const result = computeSwapInsight([
      alloc('Mid', 2000, 5),
      alloc('Cheap', 500, 5),
      alloc('Expensive', 5000, 5),
    ]);
    expect(result).not.toBeNull();
    expect(result!.from.name).toBe('Expensive');
    expect(result!.to.name).toBe('Cheap');
    expect(result!.gain).toBe(10);
  });

  it('filters out allocations with typicalCostCents <= 0', () => {
    const result = computeSwapInsight([
      alloc('Zero', 0, 5),
      alloc('Bar', 3500, 5),
      alloc('Market', 1000, 3),
    ]);
    expect(result).not.toBeNull();
    expect(result!.from.name).toBe('Bar');
    expect(result!.to.name).toBe('Market');
  });
});
