import { describe, expect, it } from 'vitest';
import { computeZoomLevels, deriveZoomState, zoomMode, ZOOM_PRESETS } from '@/components/QrScanner';

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

  it('yields a single preset for a tiny range (F15 then shows a slider)', () => {
    expect(computeZoomLevels({ min: 1, max: 1, current: 1 })).toEqual([1]);
    expect(computeZoomLevels({ min: 0.5, max: 1.2, current: 0.5 })).toEqual([1]);
  });
});

describe('QrScanner: deriveZoomState (F15 — Android late/degenerate capabilities)', () => {
  it('returns null while the track has not yet reported zoom (empty capabilities)', () => {
    // Android right after getUserMedia — zoom not populated until the track settles.
    expect(deriveZoomState({})).toBeNull();
  });

  it('returns null for a degenerate range (min === max)', () => {
    expect(deriveZoomState({ zoom: { min: 1, max: 1 } })).toBeNull();
  });

  it('derives a real range once the track settles, defaulting current to min', () => {
    expect(deriveZoomState({ zoom: { min: 1, max: 4 } })).toEqual({ min: 1, max: 4, current: 1 });
  });

  it('honours the live track zoom setting when it is within range', () => {
    expect(deriveZoomState({ zoom: { min: 1, max: 4 } }, 2.5)).toEqual({ min: 1, max: 4, current: 2.5 });
  });

  it('ignores an out-of-range current and falls back to min', () => {
    expect(deriveZoomState({ zoom: { min: 1, max: 4 } }, 9)).toEqual({ min: 1, max: 4, current: 1 });
  });
});

describe('QrScanner: zoomMode (F15 — presets vs slider vs none)', () => {
  it('is "none" when there is no zoom', () => {
    expect(zoomMode(null)).toBe('none');
  });

  it('is "presets" when at least two of 1×/2×/3× fit the range', () => {
    expect(zoomMode({ min: 1, max: 3, current: 1 })).toBe('presets');
    expect(zoomMode({ min: 1, max: 2, current: 1 })).toBe('presets');
  });

  it('degrades to "slider" when the camera zooms but presets do not qualify', () => {
    // Android's default stream often reports a narrow range — show a slider, not nothing.
    expect(zoomMode({ min: 1, max: 1.6, current: 1 })).toBe('slider');
    // A tele-only sliver where a single preset lands also gets a slider.
    expect(zoomMode({ min: 2, max: 2.5, current: 2 })).toBe('slider');
  });
});
