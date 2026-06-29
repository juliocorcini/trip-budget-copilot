import { describe, it, expect } from 'vitest';
import { decideBodyDrag, isNoSheetDragTarget } from '@/components/BottomSheet';

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

  // DEC-407: a nested scrollable (or text field) still owns the gesture — the
  // sheet must NOT start a drag-to-dismiss while it can scroll.
  it('aborts whenever a nested scrollable can still consume the pull', () => {
    expect(decideBodyDrag(20, 0, true, true)).toBe('abort');
    expect(decideBodyDrag(7, 0, true, true)).toBe('abort');
    expect(decideBodyDrag(4, 1, true, true)).toBe('abort');
  });

  it('keeps the normal rule when no nested scrollable owns the gesture', () => {
    expect(decideBodyDrag(20, 0, true, false)).toBe('drag');
    expect(decideBodyDrag(20, 0, false, false)).toBe('abort');
  });
});

// DEC-407: a touch that begins inside a text field / explicit opt-out must never
// start the sheet's drag-to-dismiss (scrolling text used to close the sheet).
describe('isNoSheetDragTarget (DEC-407 — no-drag zones)', () => {
  function bodyWith(child: HTMLElement): HTMLElement {
    const body = document.createElement('div');
    body.appendChild(child);
    return body;
  }

  it('returns true for a textarea, input or select', () => {
    const ta = document.createElement('textarea');
    const input = document.createElement('input');
    const select = document.createElement('select');
    expect(isNoSheetDragTarget(ta, bodyWith(ta))).toBe(true);
    expect(isNoSheetDragTarget(input, bodyWith(input))).toBe(true);
    expect(isNoSheetDragTarget(select, bodyWith(select))).toBe(true);
  });

  it('returns true for a contenteditable region (walking up from a child)', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    editable.appendChild(inner);
    const body = bodyWith(editable);
    expect(isNoSheetDragTarget(inner, body)).toBe(true);
  });

  it('returns true for an explicit [data-no-sheet-drag] opt-out', () => {
    const scroller = document.createElement('div');
    scroller.setAttribute('data-no-sheet-drag', '');
    expect(isNoSheetDragTarget(scroller, bodyWith(scroller))).toBe(true);
  });

  it('ignores contenteditable="false" and plain content', () => {
    const ce = document.createElement('div');
    ce.setAttribute('contenteditable', 'false');
    const plain = document.createElement('div');
    expect(isNoSheetDragTarget(ce, bodyWith(ce))).toBe(false);
    expect(isNoSheetDragTarget(plain, bodyWith(plain))).toBe(false);
    expect(isNoSheetDragTarget(null, document.createElement('div'))).toBe(false);
  });

  it('stops at the boundary — a matching ancestor above it does not count', () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-no-sheet-drag', '');
    const boundary = document.createElement('div');
    const target = document.createElement('div');
    boundary.appendChild(target);
    outer.appendChild(boundary);
    expect(isNoSheetDragTarget(target, boundary)).toBe(false);
  });
});
