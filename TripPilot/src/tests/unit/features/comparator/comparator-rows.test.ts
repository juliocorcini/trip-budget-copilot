import { describe, it, expect } from 'vitest';
import { parseUnitExtractResponse } from '@/domain/shopping';
import { outcomeToRow, isFilledRow, MAX_ROWS } from '@/features/comparator/comparator-rows';
import type { UnitExtractOutcome } from '@/utils/ai-unit-extract';

// E10 · DEC-330: the comparator photo path must NEVER silently drop a picked
// photo. Every extraction outcome — success, low-confidence, or transport
// failure — maps to exactly one visible row (a confident read fills it; anything
// uncertain becomes a row flagged "confira"). This guards the mapping the page
// runs over the parallel batch (`outcomes.map(outcomeToRow)`).

describe('outcomeToRow (comparator photo mapping)', () => {
  it('maps a confident, complete reading to a filled, non-review row', () => {
    const outcome: UnitExtractOutcome = {
      ok: true,
      item: parseUnitExtractResponse({ price: 2.49, quantity: 100, unit: 'g', label: 'Chocolate', confidence: 0.92 }),
    };
    expect(outcomeToRow(outcome, 'r1')).toEqual({
      id: 'r1',
      label: 'Chocolate',
      price: '2.49',
      quantity: '100',
      unit: 'g',
      review: false,
    });
  });

  it('maps a transport failure to an empty REVIEW row (never a silent drop)', () => {
    const offline: UnitExtractOutcome = { ok: false, error: 'offline' };
    const failed: UnitExtractOutcome = { ok: false, error: 'failed' };
    for (const outcome of [offline, failed]) {
      const row = outcomeToRow(outcome, 'rx');
      expect(row.review).toBe(true);
      expect(row).toEqual({ id: 'rx', label: '', price: '', quantity: '', unit: 'g', review: true });
    }
  });

  it('keeps a low-confidence / partial reading as a surfaced review row, not a drop', () => {
    // quantity 0 → nulled + needsReview by the parser; the row still appears with
    // the salvageable values so the traveler confirms instead of losing the photo.
    const outcome: UnitExtractOutcome = {
      ok: true,
      item: parseUnitExtractResponse({ price: 1, quantity: 0, unit: 'g', confidence: 0.9 }),
    };
    const row = outcomeToRow(outcome, 'r2');
    expect(row.review).toBe(true);
    expect(row.price).toBe('1');
    expect(row.quantity).toBe(''); // nulled value becomes an empty (editable) string
    expect(row.unit).toBe('g');
  });

  it('preserves batch length — one row per picked photo (no silent drop)', () => {
    const batch: UnitExtractOutcome[] = [
      { ok: true, item: parseUnitExtractResponse({ price: 2, quantity: 50, unit: 'g', confidence: 0.95 }) },
      { ok: false, error: 'failed' },
      { ok: true, item: parseUnitExtractResponse({ price: 3, quantity: 200, unit: 'ml', confidence: 0.95 }) },
    ];
    const rows = batch.map((o, i) => outcomeToRow(o, `r${i}`));
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.review)).toHaveLength(1);
    expect(rows.filter((r) => isFilledRow(r))).toHaveLength(2);
  });
});

describe('isFilledRow', () => {
  it('treats any of price / quantity / label as filled, and a blank row as empty', () => {
    expect(isFilledRow({ id: 'a', label: '', price: '', quantity: '', unit: 'g' })).toBe(false);
    expect(isFilledRow({ id: 'b', label: 'Leite', price: '', quantity: '', unit: 'g' })).toBe(true);
    expect(isFilledRow({ id: 'c', label: '', price: '1.50', quantity: '', unit: 'g' })).toBe(true);
    expect(isFilledRow({ id: 'd', label: '', price: '', quantity: '500', unit: 'g' })).toBe(true);
  });

  it('caps the comparator at 6 rows', () => {
    expect(MAX_ROWS).toBe(6);
  });
});
