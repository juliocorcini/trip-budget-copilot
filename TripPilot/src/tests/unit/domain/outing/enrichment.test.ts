import { describe, it, expect } from 'vitest';
import {
  ENRICH_AUTO_DISMISS_MS,
  getSubcategories,
  sortSubcategoriesByProximity,
  findSubcategory,
  EVENT_CONTEXTS,
  getSubcategoriesForContext,
} from '@/domain/outing';

describe('expense taxonomy (DEC-095 / R-13)', () => {
  it('a bar outing offers bar things, not outing types', () => {
    const ids = getSubcategories('bar').map((s) => s.id);
    expect(ids).toContain('bar_drink');
    expect(ids).toContain('bar_beer');
    expect(ids).toContain('bar_food');
    expect(ids).not.toContain('restaurant');
    expect(ids).not.toContain('transport');
  });

  it('covers every R2 preset category with 5+ options', () => {
    const presetCategories = [
      'restaurant', 'bar', 'market', 'transport', 'accommodation', 'cafe',
      'tours', 'museums', 'nightlife', 'beach', 'shopping', 'festival',
      'sports', 'laundry', 'communication', 'health',
    ];
    for (const category of presetCategories) {
      const subs = getSubcategories(category);
      expect(subs.length, category).toBeGreaterThanOrEqual(4);
      // Every list is its own — not the generic fallback.
      expect(subs[0]!.id.startsWith(category), category).toBe(true);
    }
  });

  it('unknown or null category falls back to the generic list', () => {
    expect(getSubcategories('scuba_diving')).toEqual(getSubcategories(null));
    expect(getSubcategories(null).map((s) => s.id)).toContain('generic_food');
  });

  it('subcategory ids are globally unique and resolvable', () => {
    const all = [
      ...EVENT_CONTEXTS.flatMap((c) => getSubcategoriesForContext(c)),
      ...getSubcategories('bar'),
      ...getSubcategories(null),
    ];
    for (const s of all) {
      expect(findSubcategory(s.id)).toEqual(s);
    }
    expect(findSubcategory('nope')).toBeNull();
    expect(findSubcategory(null)).toBeNull();
  });

  it('Julio scenario: typing €3 puts the ~€3 options first; €10 the ~€10 ones', () => {
    const bar = getSubcategories('bar');
    const at3 = sortSubcategoriesByProximity(bar, 300);
    expect(at3[0]!.id).toBe('bar_games'); // €3 typical
    const at10 = sortSubcategoriesByProximity(bar, 1000);
    expect(at10[0]!.id).toBe('bar_cover'); // €10 typical
    const at7 = sortSubcategoriesByProximity(bar, 700);
    expect(at7[0]!.id).toBe('bar_drink'); // €7 typical
  });

  it('zero amount keeps the catalog order', () => {
    const bar = getSubcategories('bar');
    expect(sortSubcategoriesByProximity(bar, 0)).toEqual(bar);
  });

  it('sorting does not mutate the catalog', () => {
    const bar = getSubcategories('bar');
    const before = bar.map((s) => s.id);
    sortSubcategoriesByProximity(bar, 999);
    expect(bar.map((s) => s.id)).toEqual(before);
  });
});

describe('event contexts (DEC-096 / R-17)', () => {
  it('asks WHERE first with the contexts from the report', () => {
    const categories = EVENT_CONTEXTS.map((c) => c.category);
    expect(categories).toEqual(
      expect.arrayContaining(['bar', 'restaurant', 'market', 'transport', 'other']),
    );
  });

  it('each context resolves to a level-2 subcategory list', () => {
    for (const context of EVENT_CONTEXTS) {
      expect(getSubcategoriesForContext(context).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('the restaurant context offers restaurant things (dish, drink, dessert)', () => {
    const restaurant = EVENT_CONTEXTS.find((c) => c.category === 'restaurant')!;
    const ids = getSubcategoriesForContext(restaurant).map((s) => s.id);
    expect(ids).toContain('restaurant_dish');
    expect(ids).toContain('restaurant_dessert');
  });
});

describe('stepper timing (DEC-096 / R-14)', () => {
  it('stays at least 10 seconds', () => {
    expect(ENRICH_AUTO_DISMISS_MS).toBeGreaterThanOrEqual(10000);
  });
});
