import { describe, it, expect } from 'vitest';
import { calculateGaugePosition } from '@/domain/outing';

// Visual segment boundaries (flex 3:2:1:1): green ends at 42.857%,
// primary ends at 71.428%.
const TARGET_END = 300 / 7;
const CEILING_END = 500 / 7;

describe('calculateGaugePosition (DEC-113 / R5-09)', () => {
  it('field scenario: spent 40 of target 35 / ceiling 45 / max 55 stays in the primary zone', () => {
    const pos = calculateGaugePosition(4000, 3500, 4500, 5500);

    // Halfway between target and ceiling → halfway through the primary segment.
    expect(pos).toBeGreaterThan(TARGET_END);
    expect(pos).toBeLessThan(CEILING_END);
    expect(pos).toBeCloseTo(TARGET_END + (CEILING_END - TARGET_END) / 2, 5);
  });

  it('spent exactly at target sits on the green/primary boundary', () => {
    expect(calculateGaugePosition(3500, 3500, 4500, 5500)).toBeCloseTo(TARGET_END, 5);
  });

  it('spent exactly at ceiling sits on the primary/amber boundary', () => {
    expect(calculateGaugePosition(4500, 3500, 4500, 5500)).toBeCloseTo(CEILING_END, 5);
  });

  it('spent below target scales inside the green zone', () => {
    expect(calculateGaugePosition(1750, 3500, 4500, 5500)).toBeCloseTo(TARGET_END / 2, 5);
  });

  it('spent between ceiling and max scales inside the amber/red zone', () => {
    const pos = calculateGaugePosition(5000, 3500, 4500, 5500);
    expect(pos).toBeGreaterThan(CEILING_END);
    expect(pos).toBeLessThan(100);
    expect(pos).toBeCloseTo(CEILING_END + (100 - CEILING_END) / 2, 5);
  });

  it('clamps at the extremes', () => {
    expect(calculateGaugePosition(0, 3500, 4500, 5500)).toBe(0);
    expect(calculateGaugePosition(-100, 3500, 4500, 5500)).toBe(0);
    expect(calculateGaugePosition(5500, 3500, 4500, 5500)).toBe(100);
    expect(calculateGaugePosition(9000, 3500, 4500, 5500)).toBe(100);
  });

  it('handles degenerate thresholds without NaN', () => {
    // No max at all.
    expect(calculateGaugePosition(1000, 0, 0, 0)).toBe(0);
    // target == ceiling == max: anything below max maps via the last zone.
    const collapsed = calculateGaugePosition(500, 1000, 1000, 1000);
    expect(Number.isFinite(collapsed)).toBe(true);
    expect(collapsed).toBeGreaterThanOrEqual(0);
    expect(collapsed).toBeLessThanOrEqual(100);
    // target == 0 with valid ceiling/max.
    const noTarget = calculateGaugePosition(500, 0, 1000, 2000);
    expect(Number.isFinite(noTarget)).toBe(true);
    expect(noTarget).toBeGreaterThan(TARGET_END);
    expect(noTarget).toBeLessThanOrEqual(CEILING_END);
  });
});
