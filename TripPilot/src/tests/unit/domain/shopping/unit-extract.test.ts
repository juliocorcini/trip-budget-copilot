import { describe, it, expect } from 'vitest';
import { parseUnitExtractResponse, UNIT_REVIEW_CONFIDENCE } from '@/domain/shopping';

// DEC-284: the comparator photo path must NEVER trust a number blindly. The
// parser is pure and defensive — partial/garbage model output degrades into
// nulls + a `needsReview` flag rather than a confident wrong row.

describe('parseUnitExtractResponse', () => {
  it('keeps a confident, complete reading and does not flag it for review', () => {
    const item = parseUnitExtractResponse({
      price: 2.49,
      quantity: 100,
      unit: 'g',
      label: 'Chocolate ao leite',
      currency: 'EUR',
      confidence: 0.92,
    });
    expect(item).toEqual({
      price: 2.49,
      quantity: 100,
      unit: 'g',
      label: 'Chocolate ao leite',
      currency: 'EUR',
      confidence: 0.92,
      needsReview: false,
    });
  });

  it('flags a complete reading for review when confidence is below the threshold', () => {
    const item = parseUnitExtractResponse({
      price: 1,
      quantity: 200,
      unit: 'g',
      confidence: UNIT_REVIEW_CONFIDENCE - 0.01,
    });
    expect(item.needsReview).toBe(true);
    // Below-threshold but still complete: the values survive for the user to confirm.
    expect(item.price).toBe(1);
    expect(item.quantity).toBe(200);
    expect(item.unit).toBe('g');
  });

  it('normalizes unit aliases and accents to the picker set', () => {
    expect(parseUnitExtractResponse({ unit: 'Kg' }).unit).toBe('kg');
    expect(parseUnitExtractResponse({ unit: 'LITROS' }).unit).toBe('l');
    expect(parseUnitExtractResponse({ unit: 'unidade' }).unit).toBe('un');
    expect(parseUnitExtractResponse({ unit: 'gramas' }).unit).toBe('g');
  });

  it('converts mg into grams so unit and quantity stay consistent', () => {
    const item = parseUnitExtractResponse({ price: 3, quantity: 500, unit: 'mg', confidence: 0.9 });
    expect(item.unit).toBe('g');
    expect(item.quantity).toBe(0.5);
  });

  it('converts cl into millilitres', () => {
    const item = parseUnitExtractResponse({ price: 3, quantity: 50, unit: 'cl', confidence: 0.9 });
    expect(item.unit).toBe('ml');
    expect(item.quantity).toBe(500);
  });

  it('marks an unknown unit as null and flags review', () => {
    const item = parseUnitExtractResponse({ price: 3, quantity: 2, unit: 'dozen', confidence: 0.9 });
    expect(item.unit).toBeNull();
    expect(item.needsReview).toBe(true);
  });

  it('nulls a missing or non-numeric price and flags review', () => {
    expect(parseUnitExtractResponse({ quantity: 100, unit: 'g', confidence: 0.9 }).price).toBeNull();
    const bad = parseUnitExtractResponse({ price: '2,49', quantity: 100, unit: 'g', confidence: 0.9 });
    expect(bad.price).toBeNull();
    expect(bad.needsReview).toBe(true);
  });

  it('nulls a zero or negative quantity and flags review', () => {
    expect(parseUnitExtractResponse({ price: 1, quantity: 0, unit: 'g', confidence: 0.9 }).quantity).toBeNull();
    expect(parseUnitExtractResponse({ price: 1, quantity: -5, unit: 'g', confidence: 0.9 }).quantity).toBeNull();
    expect(parseUnitExtractResponse({ price: 1, quantity: 0, unit: 'g', confidence: 0.9 }).needsReview).toBe(true);
  });

  it('clamps confidence to 0..1 and treats non-numbers as 0', () => {
    expect(parseUnitExtractResponse({ confidence: 5 }).confidence).toBe(1);
    expect(parseUnitExtractResponse({ confidence: -2 }).confidence).toBe(0);
    expect(parseUnitExtractResponse({ confidence: Number.NaN }).confidence).toBe(0);
    expect(parseUnitExtractResponse({ confidence: 'high' }).confidence).toBe(0);
  });

  it('keeps only ISO-4217-shaped currency codes', () => {
    expect(parseUnitExtractResponse({ currency: 'eur' }).currency).toBe('EUR');
    expect(parseUnitExtractResponse({ currency: 'usd' }).currency).toBe('USD');
    expect(parseUnitExtractResponse({ currency: '€' }).currency).toBeNull();
    expect(parseUnitExtractResponse({ currency: 'Euros' }).currency).toBeNull();
  });

  it('trims a label and drops an empty one', () => {
    expect(parseUnitExtractResponse({ label: '  Leite  ' }).label).toBe('Leite');
    expect(parseUnitExtractResponse({ label: '   ' }).label).toBeNull();
    expect(parseUnitExtractResponse({ label: 42 }).label).toBeNull();
  });

  it('degrades a non-object payload into an all-null review item', () => {
    for (const raw of [null, undefined, 'oops', 7, []]) {
      const item = parseUnitExtractResponse(raw);
      expect(item.price).toBeNull();
      expect(item.quantity).toBeNull();
      expect(item.unit).toBeNull();
      expect(item.confidence).toBe(0);
      expect(item.needsReview).toBe(true);
    }
  });
});
