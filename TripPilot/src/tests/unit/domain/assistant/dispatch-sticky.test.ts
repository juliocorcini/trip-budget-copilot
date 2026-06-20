import { describe, it, expect } from 'vitest';
import { buildExpenseStickyPatch } from '@/domain/assistant/dispatch';
import type { CurrentPlace } from '@/domain/types/common';

/**
 * DEC-246 — an AI expense must leave the app in the same state a manual one does:
 * the place becomes sticky and the category becomes the next default. This is the
 * pure decision behind that single settings write.
 */

const place: CurrentPlace = { label: 'Bar do Zé', lat: 38.7, lng: -9.1, placeId: 'p1' };

describe('buildExpenseStickyPatch', () => {
  it('remembers a new place and the category on a first entry', () => {
    const patch = buildExpenseStickyPatch(place, 'bar', { currentPlace: null, lastExpenseCategory: null });
    expect(patch.currentPlace).toEqual(place);
    expect(patch.lastExpenseCategory).toBe('bar');
  });

  it('writes nothing when the place and category are unchanged', () => {
    const patch = buildExpenseStickyPatch(place, 'bar', {
      currentPlace: { ...place },
      lastExpenseCategory: 'bar',
    });
    expect(Object.keys(patch)).toHaveLength(0);
  });

  it('updates only the category when the place stayed the same', () => {
    const patch = buildExpenseStickyPatch(place, 'restaurant', {
      currentPlace: { ...place },
      lastExpenseCategory: 'bar',
    });
    expect(patch.currentPlace).toBeUndefined();
    expect(patch.lastExpenseCategory).toBe('restaurant');
  });

  it('never clears a remembered place when the expense has none', () => {
    const patch = buildExpenseStickyPatch(null, 'bar', {
      currentPlace: { ...place },
      lastExpenseCategory: 'bar',
    });
    expect('currentPlace' in patch).toBe(false);
  });
});
