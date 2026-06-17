import { describe, expect, it } from 'vitest';
import { computeZoomLevels, ZOOM_PRESETS } from '@/components/QrScanner';

describe('QrScanner: computeZoomLevels (D-BUG-03)', () => {
  it('returns no presets when the camera reports no zoom capability', () => {
    expect(computeZoomLevels(null)).toEqual([]);
  });

  it('shows every preset within a wide optical/digital range', () => {
    expect(computeZoomLevels({ min: 1, max: 8, current: 1 })).toEqual(ZOOM_PRESETS);
  });

  it('drops presets outside the reported range', () => {
    // A lens that only goes to 2× hides the 3× chip.
    expect(computeZoomLevels({ min: 1, max: 2, current: 1 })).toEqual([1, 2]);
    // A tele lens that starts at 2× hides the 1× chip.
    expect(computeZoomLevels({ min: 2, max: 3, current: 2 })).toEqual([2, 3]);
  });

  it('yields a single preset (UI then hides the row) for a tiny range', () => {
    expect(computeZoomLevels({ min: 1, max: 1, current: 1 })).toEqual([1]);
    expect(computeZoomLevels({ min: 0.5, max: 1.2, current: 0.5 })).toEqual([1]);
  });
});
