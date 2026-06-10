import { describe, it, expect } from 'vitest';
import { getEnrichmentCategories } from '@/domain/outing';
import { formatSessionDuration } from '@/domain/outing';

describe('getEnrichmentCategories (DEC-078 — FIELD-08)', () => {
  it('bar sessions offer the field-report set: drink/food/transport/ticket/other', () => {
    const categories = getEnrichmentCategories('bar');
    expect(categories).toEqual(['bar', 'restaurant', 'transport', 'entertainment', 'other']);
  });

  it('every profile set ends with an "other" escape hatch', () => {
    for (const profileCategory of ['bar', 'restaurant', 'festival', 'market', 'outing']) {
      expect(getEnrichmentCategories(profileCategory)).toContain('other');
    }
  });

  it('null profile (one-off event session) falls back to the default set', () => {
    expect(getEnrichmentCategories(null)).toEqual([
      'restaurant', 'bar', 'transport', 'entertainment', 'other',
    ]);
  });

  it('unknown profile category falls back to the default set (data-driven, no throw)', () => {
    expect(getEnrichmentCategories('scuba_diving')).toEqual(getEnrichmentCategories(null));
  });
});

describe('formatSessionDuration (DEC-079 — FIELD-09)', () => {
  it('formats hours and minutes as "3h12"', () => {
    expect(
      formatSessionDuration('2026-06-12T20:00:00.000Z', '2026-06-12T23:12:00.000Z'),
    ).toBe('3h12');
  });

  it('formats sub-hour durations as "45min"', () => {
    expect(
      formatSessionDuration('2026-06-12T20:00:00.000Z', '2026-06-12T20:45:00.000Z'),
    ).toBe('45min');
  });

  it('pads minutes: 2h05', () => {
    expect(
      formatSessionDuration('2026-06-10T21:00:00.000Z', '2026-06-10T23:05:00.000Z'),
    ).toBe('2h05');
  });

  it('null endedAt (still active) renders empty', () => {
    expect(formatSessionDuration('2026-06-12T20:00:00.000Z', null)).toBe('');
  });

  it('zero or negative duration clamps to "0min"', () => {
    expect(
      formatSessionDuration('2026-06-12T20:00:00.000Z', '2026-06-12T20:00:00.000Z'),
    ).toBe('0min');
  });
});
