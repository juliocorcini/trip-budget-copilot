import { describe, expect, it } from 'vitest';
import {
  clampOffset,
  clampScale,
  distance,
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  nextDoubleTapScale,
} from '@/features/attachments/attachment-zoom';

describe('attachment-zoom: clampScale', () => {
  it('pins below MIN_SCALE up to the minimum', () => {
    expect(clampScale(0.5)).toBe(MIN_SCALE);
    expect(clampScale(-3)).toBe(MIN_SCALE);
  });

  it('caps above MAX_SCALE at the maximum', () => {
    expect(clampScale(10)).toBe(MAX_SCALE);
  });

  it('passes values inside the range through unchanged', () => {
    expect(clampScale(2.5)).toBe(2.5);
  });

  it('honors a custom range and falls back to min on non-finite input', () => {
    expect(clampScale(5, 1, 3)).toBe(3);
    expect(clampScale(Number.NaN)).toBe(MIN_SCALE);
  });
});

describe('attachment-zoom: clampOffset', () => {
  const container = { width: 300, height: 400 };

  it('pins the image to center when it fits the container (no overflow)', () => {
    const content = { width: 300, height: 200 };
    expect(clampOffset({ x: 50, y: -30 }, 1, container, content)).toEqual({ x: 0, y: 0 });
  });

  it('limits travel to half the overflow on each axis', () => {
    const content = { width: 300, height: 200 };
    // scale 2 → scaled 600x400. overflowX=(600-300)/2=150, overflowY=(400-400)/2=0.
    expect(clampOffset({ x: 200, y: -50 }, 2, container, content)).toEqual({ x: 150, y: 0 });
    expect(clampOffset({ x: -400, y: 80 }, 2, container, content)).toEqual({ x: -150, y: 0 });
  });

  it('keeps an in-bounds offset untouched', () => {
    const content = { width: 300, height: 200 };
    expect(clampOffset({ x: 100, y: 0 }, 2, container, content)).toEqual({ x: 100, y: 0 });
  });
});

describe('attachment-zoom: nextDoubleTapScale', () => {
  it('zooms in from fit', () => {
    expect(nextDoubleTapScale(MIN_SCALE)).toBe(DOUBLE_TAP_SCALE);
    expect(nextDoubleTapScale(1.005)).toBe(DOUBLE_TAP_SCALE);
  });

  it('resets to fit when already zoomed', () => {
    expect(nextDoubleTapScale(DOUBLE_TAP_SCALE)).toBe(MIN_SCALE);
    expect(nextDoubleTapScale(MAX_SCALE)).toBe(MIN_SCALE);
  });
});

describe('attachment-zoom: distance', () => {
  it('computes the euclidean distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
});
