import { describe, it, expect } from 'vitest';
import { shouldOfferModeReveal, MODE_REVEAL_MIN_EXPENSES } from '@/domain/app-mode';

describe('shouldOfferModeReveal (M22)', () => {
  const threshold = MODE_REVEAL_MIN_EXPENSES;

  it('offers once the expense count reaches the threshold in simple mode', () => {
    expect(shouldOfferModeReveal('simple', false, threshold, threshold)).toBe(true);
    expect(shouldOfferModeReveal('simple', false, threshold + 10, threshold)).toBe(true);
  });

  it('stays quiet below the threshold', () => {
    expect(shouldOfferModeReveal('simple', false, threshold - 1, threshold)).toBe(false);
    expect(shouldOfferModeReveal('simple', false, 0, threshold)).toBe(false);
  });

  it('never offers again once dismissed', () => {
    expect(shouldOfferModeReveal('simple', true, threshold + 100, threshold)).toBe(false);
  });

  it('never offers in complete mode', () => {
    expect(shouldOfferModeReveal('complete', false, threshold + 100, threshold)).toBe(false);
  });

  it('respects a custom threshold', () => {
    expect(shouldOfferModeReveal('simple', false, 2, 3)).toBe(false);
    expect(shouldOfferModeReveal('simple', false, 3, 3)).toBe(true);
  });

  it('ships a sensible default threshold', () => {
    expect(MODE_REVEAL_MIN_EXPENSES).toBeGreaterThan(0);
  });
});
