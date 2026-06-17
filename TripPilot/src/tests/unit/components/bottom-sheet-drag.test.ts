import { describe, it, expect } from 'vitest';
import { decideBodyDrag } from '@/components/BottomSheet';

// D-BUG-12: "pull the sheet body down from the top to close". The rule must let
// the body scroll in every other case, and never hijack a horizontal gesture.
describe('decideBodyDrag (D-BUG-12 — body drag-to-dismiss)', () => {
  it('commits to a drag on a clear downward pull while the body is at the top', () => {
    expect(decideBodyDrag(20, 0, true)).toBe('drag');
    expect(decideBodyDrag(12, 4, true)).toBe('drag');
  });

  it('aborts an upward move so the list scrolls down normally', () => {
    expect(decideBodyDrag(-10, 0, true)).toBe('abort');
    expect(decideBodyDrag(-3, 2, true)).toBe('abort');
  });

  it('aborts a horizontal-dominant gesture (e.g. a chip row swipe)', () => {
    expect(decideBodyDrag(5, 40, true)).toBe('abort');
    expect(decideBodyDrag(10, 30, true)).toBe('abort');
  });

  it('aborts a downward pull when the body is NOT at the top (mid-list scroll)', () => {
    expect(decideBodyDrag(20, 0, false)).toBe('abort');
  });

  it('waits while the move is still too small to classify', () => {
    expect(decideBodyDrag(0, 0, true)).toBe('pending');
    expect(decideBodyDrag(4, 1, true)).toBe('pending');
    expect(decideBodyDrag(6, 0, true)).toBe('pending');
  });

  it('treats the 6px boundary as the commit threshold', () => {
    expect(decideBodyDrag(6, 0, true)).toBe('pending');
    expect(decideBodyDrag(7, 0, true)).toBe('drag');
  });
});
