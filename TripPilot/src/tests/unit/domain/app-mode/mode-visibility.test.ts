import { describe, it, expect } from 'vitest';
import { visibleInMode, isAdvancedRouteBlocked } from '@/domain/app-mode';

interface Item {
  id: string;
  advanced?: boolean;
  simpleOnly?: boolean;
}

const items: Item[] = [
  { id: 'dashboard' },
  { id: 'expenses' },
  { id: 'planner', advanced: true },
  { id: 'more' },
];

describe('visibleInMode (M19)', () => {
  it('returns every item in complete mode', () => {
    const result = visibleInMode(items, 'complete');
    expect(result.map((i) => i.id)).toEqual(['dashboard', 'expenses', 'planner', 'more']);
  });

  it('drops advanced items in simple mode', () => {
    const result = visibleInMode(items, 'simple');
    expect(result.map((i) => i.id)).toEqual(['dashboard', 'expenses', 'more']);
  });

  it('keeps items without the advanced flag', () => {
    const plain: Item[] = [{ id: 'a' }, { id: 'b' }];
    const result = visibleInMode(plain, 'simple');
    expect(result).toHaveLength(2);
  });

  it('does not mutate the input array', () => {
    const input = [...items];
    visibleInMode(input, 'simple');
    expect(input).toHaveLength(4);
  });

  it('handles an empty list', () => {
    expect(visibleInMode([], 'simple')).toEqual([]);
  });

  // C06/DEC-298: simpleOnly is the mirror of advanced — it surfaces ONLY in
  // simple mode (Settings taking the hidden Copilot's slot for a 2+2 bar).
  describe('simpleOnly (C06/DEC-298)', () => {
    const nav: Item[] = [
      { id: 'trip' },
      { id: 'copilot', advanced: true },
      { id: 'settings', simpleOnly: true },
    ];

    it('hides simpleOnly items in complete mode (gear owns Settings there)', () => {
      const result = visibleInMode(nav, 'complete');
      expect(result.map((i) => i.id)).toEqual(['trip', 'copilot']);
    });

    it('shows simpleOnly and drops advanced in simple mode (2+2 swap)', () => {
      const result = visibleInMode(nav, 'simple');
      expect(result.map((i) => i.id)).toEqual(['trip', 'settings']);
    });

    it('keeps the right-side count at two across both modes', () => {
      expect(visibleInMode(nav, 'complete')).toHaveLength(2);
      expect(visibleInMode(nav, 'simple')).toHaveLength(2);
    });
  });
});

describe('isAdvancedRouteBlocked (M20)', () => {
  it('blocks an advanced route in simple mode without override', () => {
    expect(isAdvancedRouteBlocked('simple', false)).toBe(true);
  });

  it('lets the route through once the user overrides (escape hatch)', () => {
    expect(isAdvancedRouteBlocked('simple', true)).toBe(false);
  });

  it('never blocks in complete mode', () => {
    expect(isAdvancedRouteBlocked('complete', false)).toBe(false);
    expect(isAdvancedRouteBlocked('complete', true)).toBe(false);
  });
});
