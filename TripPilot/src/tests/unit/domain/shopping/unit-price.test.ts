import { describe, it, expect } from 'vitest';
import {
  resolveUnit,
  normalizeQuantity,
  compareUnitPrice,
  COMPARATOR_UNITS,
  type UnitPriceItemInput,
} from '@/domain/shopping';

// DEC-283: the cost-benefit comparator is a PURE price-per-unit read. The math
// must be exact and the verdict honest — a comparator that picks the wrong
// package, or compares grams against units, is worse than none.

describe('resolveUnit', () => {
  it('resolves canonical codes', () => {
    expect(resolveUnit('g')?.code).toBe('g');
    expect(resolveUnit('kg')?.code).toBe('kg');
    expect(resolveUnit('ml')?.code).toBe('ml');
    expect(resolveUnit('l')?.code).toBe('l');
    expect(resolveUnit('un')?.code).toBe('un');
  });

  it('tolerates case, padding, plurals, accents and a trailing dot', () => {
    expect(resolveUnit('  KG ')?.code).toBe('kg');
    expect(resolveUnit('Quilos')?.code).toBe('kg');
    expect(resolveUnit('gramas')?.code).toBe('g');
    expect(resolveUnit('Litros')?.code).toBe('l');
    expect(resolveUnit('unidades')?.code).toBe('un');
    expect(resolveUnit('ml.')?.code).toBe('ml');
  });

  it('maps each unit to the right dimension', () => {
    expect(resolveUnit('kg')?.dimension).toBe('weight');
    expect(resolveUnit('l')?.dimension).toBe('volume');
    expect(resolveUnit('un')?.dimension).toBe('count');
  });

  it('returns null for empty / unknown tokens', () => {
    expect(resolveUnit('')).toBeNull();
    expect(resolveUnit('   ')).toBeNull();
    expect(resolveUnit('banana')).toBeNull();
    expect(resolveUnit(null)).toBeNull();
    expect(resolveUnit(undefined)).toBeNull();
  });

  it('exposes the picker units', () => {
    expect(COMPARATOR_UNITS).toEqual(['g', 'kg', 'ml', 'l', 'un']);
  });
});

describe('normalizeQuantity', () => {
  it('keeps base units unchanged', () => {
    expect(normalizeQuantity(200, 'g')).toEqual({ baseValue: 200, dimension: 'weight' });
    expect(normalizeQuantity(500, 'ml')).toEqual({ baseValue: 500, dimension: 'volume' });
    expect(normalizeQuantity(6, 'un')).toEqual({ baseValue: 6, dimension: 'count' });
  });

  it('scales up to the base unit (kg→g, L→ml)', () => {
    expect(normalizeQuantity(2, 'kg')).toEqual({ baseValue: 2000, dimension: 'weight' });
    expect(normalizeQuantity(1.5, 'l')).toEqual({ baseValue: 1500, dimension: 'volume' });
    expect(normalizeQuantity(50, 'cl')).toEqual({ baseValue: 500, dimension: 'volume' });
    expect(normalizeQuantity(250, 'mg')).toEqual({ baseValue: 0.25, dimension: 'weight' });
  });

  it('rejects non-positive, non-finite, or unknown-unit quantities', () => {
    expect(normalizeQuantity(0, 'g')).toBeNull();
    expect(normalizeQuantity(-5, 'g')).toBeNull();
    expect(normalizeQuantity(Number.NaN, 'g')).toBeNull();
    expect(normalizeQuantity(100, 'xyz')).toBeNull();
  });
});

describe('compareUnitPrice — the verdict', () => {
  // Julio's canonical example: 120 g for €1.00 vs 200 g for €2.00.
  // A = 100c/120g = 0.8333 c/g → €8.33/kg; B = 200c/200g = 1.0 c/g → €10/kg.
  const choc: UnitPriceItemInput[] = [
    { id: 'a', label: '120 g', priceCents: 100, quantity: 120, unit: 'g' },
    { id: 'b', label: '200 g', priceCents: 200, quantity: 200, unit: 'g' },
  ];

  it('picks the lower price-per-unit as the best buy', () => {
    const r = compareUnitPrice(choc);
    expect(r.bestId).toBe('a');
    expect(r.worstId).toBe('b');
    expect(r.mixedDimensions).toBe(false);
    expect(r.comparableCount).toBe(2);
  });

  it('reports per-unit prices in the display unit (per kg)', () => {
    const r = compareUnitPrice(choc);
    const a = r.entries.find((e) => e.id === 'a')!;
    const b = r.entries.find((e) => e.id === 'b')!;
    expect(a.displayUnit).toBe('kg');
    expect(a.perDisplayUnitCents).toBeCloseTo(833.33, 1); // €8.33/kg
    expect(b.perDisplayUnitCents).toBeCloseTo(1000, 6); // €10/kg
    expect(a.perBaseCents).toBeCloseTo(100 / 120, 8);
  });

  it('computes how much cheaper the best is vs the worst', () => {
    const r = compareUnitPrice(choc);
    // (1000 - 833.33) / 1000 ≈ 16.67%
    expect(r.savingsPct).toBeCloseTo(((1000 - 100 / 120 * 1000) / 1000) * 100, 6);
    expect(r.savingsPct).toBeGreaterThan(16);
    expect(r.savingsPct).toBeLessThan(17);
  });

  it('handles the "5 small vs 1 big" framing — same unit, real winner', () => {
    // 20 g @ €0.50 (50c) vs 100 g @ €2.00 (200c).
    // small = 50/20 = 2.5 c/g; big = 200/100 = 2.0 c/g → big wins.
    const r = compareUnitPrice([
      { id: 'small', priceCents: 50, quantity: 20, unit: 'g' },
      { id: 'big', priceCents: 200, quantity: 100, unit: 'g' },
    ]);
    expect(r.bestId).toBe('big');
    expect(r.savingsPct).toBeCloseTo(20, 6); // (2.5-2.0)/2.5 = 20%
  });

  it('compares across compatible units (kg vs g)', () => {
    // 1 kg @ €9 (900c) → 0.9 c/g; 200 g @ €2 (200c) → 1.0 c/g → kg wins.
    const r = compareUnitPrice([
      { id: 'bulk', priceCents: 900, quantity: 1, unit: 'kg' },
      { id: 'small', priceCents: 200, quantity: 200, unit: 'g' },
    ]);
    expect(r.bestId).toBe('bulk');
    expect(r.mixedDimensions).toBe(false);
  });

  it('flags a tie when the top two are within 3%', () => {
    // 100 c/100 g = 1.0 c/g vs 102 c/100 g = 1.02 c/g → ~2% apart.
    const r = compareUnitPrice([
      { id: 'x', priceCents: 100, quantity: 100, unit: 'g' },
      { id: 'y', priceCents: 102, quantity: 100, unit: 'g' },
    ]);
    expect(r.tie).toBe(true);
    expect(r.bestId).toBe('x'); // still names the marginally cheaper one
  });

  it('does NOT flag a tie when the gap is clear', () => {
    expect(compareUnitPrice(choc).tie).toBe(false);
  });

  it('refuses to compare across dimensions (weight vs count)', () => {
    const r = compareUnitPrice([
      { id: 'bar', priceCents: 200, quantity: 100, unit: 'g' },
      { id: 'pack', priceCents: 500, quantity: 6, unit: 'un' },
    ]);
    expect(r.mixedDimensions).toBe(true);
    expect(r.bestId).toBeNull();
    expect(r.savingsPct).toBeNull();
    // each item still exposes its own per-unit price for display
    expect(r.entries.every((e) => e.valid)).toBe(true);
  });

  it('needs at least two comparable items to declare a winner', () => {
    const r = compareUnitPrice([{ id: 'only', priceCents: 100, quantity: 100, unit: 'g' }]);
    expect(r.bestId).toBeNull();
    expect(r.comparableCount).toBe(1);
    expect(r.entries[0]!.valid).toBe(true);
  });

  it('skips invalid items but still ranks the valid ones', () => {
    const r = compareUnitPrice([
      { id: 'good1', priceCents: 100, quantity: 100, unit: 'g' },
      { id: 'good2', priceCents: 300, quantity: 100, unit: 'g' },
      { id: 'bad-unit', priceCents: 100, quantity: 100, unit: '???' },
      { id: 'bad-qty', priceCents: 100, quantity: 0, unit: 'g' },
    ]);
    expect(r.comparableCount).toBe(2);
    expect(r.bestId).toBe('good1');
    expect(r.entries.find((e) => e.id === 'bad-unit')!.valid).toBe(false);
    expect(r.entries.find((e) => e.id === 'bad-qty')!.valid).toBe(false);
  });

  it('treats a free item (0 price) as the unbeatable best', () => {
    const r = compareUnitPrice([
      { id: 'free', priceCents: 0, quantity: 100, unit: 'g' },
      { id: 'paid', priceCents: 200, quantity: 100, unit: 'g' },
    ]);
    expect(r.bestId).toBe('free');
    expect(r.savingsPct).toBeCloseTo(100, 6);
  });

  it('returns an empty-ish result for no items', () => {
    const r = compareUnitPrice([]);
    expect(r.entries).toEqual([]);
    expect(r.bestId).toBeNull();
    expect(r.comparableCount).toBe(0);
  });
});
