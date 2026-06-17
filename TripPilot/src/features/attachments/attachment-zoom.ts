/**
 * D-BUG-17: pure math for the in-viewer photo zoom (pinch + double-tap + pan).
 * Kept transform-only and side-effect-free so the gesture handling in
 * `AttachmentViewer` stays thin and the bounds logic is unit-testable.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export function clampScale(scale: number, min = MIN_SCALE, max = MAX_SCALE): number {
  if (!Number.isFinite(scale)) return min;
  return Math.min(max, Math.max(min, scale));
}

/**
 * Clamp a pan offset so a scaled, centered image can never be dragged past its
 * own edges. At scale 1 the image is pinned to the center (offset 0). On each
 * axis the maximum travel is half the overflow ((scaled − container) / 2).
 */
export function clampOffset(offset: Point, scale: number, container: Size, content: Size): Point {
  const maxX = Math.max(0, (content.width * scale - container.width) / 2);
  const maxY = Math.max(0, (content.height * scale - container.height) / 2);
  const clamp = (value: number, max: number): number => {
    const bounded = Math.min(max, Math.max(-max, value));
    return bounded === 0 ? 0 : bounded; // normalize -0 → 0
  };
  return { x: clamp(offset.x, maxX), y: clamp(offset.y, maxY) };
}

/** Double-tap toggles between fit (1×) and a comfortable zoomed level. */
export function nextDoubleTapScale(current: number): number {
  return current > MIN_SCALE + 0.01 ? MIN_SCALE : DOUBLE_TAP_SCALE;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
