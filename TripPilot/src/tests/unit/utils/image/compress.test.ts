import { describe, it, expect } from 'vitest';
import { computeScaledDimensions } from '@/utils/image/compress';

describe('computeScaledDimensions (DEC-206 / G1)', () => {
  it('never upscales an image already within bounds', () => {
    expect(computeScaledDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('keeps dimensions when the longest side equals the limit', () => {
    expect(computeScaledDimensions(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('downscales a landscape image preserving aspect ratio', () => {
    // longest = 3200 → scale 0.5 → 1600 x 1200
    expect(computeScaledDimensions(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('downscales a portrait image preserving aspect ratio', () => {
    // longest = 3200 (height) → scale 0.5 → 1200 x 1600
    expect(computeScaledDimensions(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('downscales a square image to the limit on both sides', () => {
    expect(computeScaledDimensions(2000, 2000, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('rounds the scaled minor side to the nearest pixel', () => {
    // longest = 1000 → scale 0.24 → width 240, height round(333 * 0.24 = 79.92) = 80
    expect(computeScaledDimensions(1000, 333, 240)).toEqual({ width: 240, height: 80 });
  });

  it('floors a vanishing minor side to at least 1px', () => {
    // longest = 1600 → scale 0.15 → height round(3 * 0.15 = 0.45) = 0 → clamped to 1
    expect(computeScaledDimensions(1600, 3, 240)).toEqual({ width: 240, height: 1 });
  });

  it('returns a zero box for degenerate inputs', () => {
    expect(computeScaledDimensions(0, 100, 1600)).toEqual({ width: 0, height: 0 });
    expect(computeScaledDimensions(100, 100, 0)).toEqual({ width: 0, height: 0 });
  });
});
