import { describe, it, expect } from 'vitest';
import {
  computeCoverCrop,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from '@/utils/image/og-footer';

/**
 * DEC-458 — the pure math of the branded OG variant: the photo must COVER the
 * 1200×630 canvas (fill + center-crop, never letterbox, never stretch).
 */
describe('computeCoverCrop', () => {
  it('wide source: full height used, sides cropped symmetrically', () => {
    // 4000×1000 into 1200×630 → scale by height (0.63), crop width.
    const crop = computeCoverCrop(4000, 1000, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)!;
    expect(crop.sh).toBe(1000);
    expect(crop.sw).toBeCloseTo(1200 / (630 / 1000), 6);
    expect(crop.sy).toBe(0);
    expect(crop.sx).toBeCloseTo((4000 - crop.sw) / 2, 6);
    // Selected rect has exactly the destination aspect ratio.
    expect(crop.sw / crop.sh).toBeCloseTo(OG_IMAGE_WIDTH / OG_IMAGE_HEIGHT, 6);
  });

  it('tall source (portrait photo): full width used, top/bottom cropped', () => {
    const crop = computeCoverCrop(1000, 2000, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)!;
    expect(crop.sw).toBe(1000);
    expect(crop.sx).toBe(0);
    expect(crop.sy).toBeCloseTo((2000 - crop.sh) / 2, 6);
    expect(crop.sw / crop.sh).toBeCloseTo(OG_IMAGE_WIDTH / OG_IMAGE_HEIGHT, 6);
  });

  it('exact-ratio source: no crop at all', () => {
    const crop = computeCoverCrop(2400, 1260, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)!;
    expect(crop).toEqual({ sx: 0, sy: 0, sw: 2400, sh: 1260 });
  });

  it('upscales small sources instead of leaving borders', () => {
    const crop = computeCoverCrop(600, 315, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)!;
    expect(crop).toEqual({ sx: 0, sy: 0, sw: 600, sh: 315 });
  });

  it('rejects degenerate dimensions', () => {
    expect(computeCoverCrop(0, 100, 1200, 630)).toBeNull();
    expect(computeCoverCrop(100, -1, 1200, 630)).toBeNull();
    expect(computeCoverCrop(100, 100, 0, 630)).toBeNull();
  });
});
