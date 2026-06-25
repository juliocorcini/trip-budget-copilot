import type { UnitExtractOutcome } from '@/utils/ai-unit-extract';

/**
 * Pure row helpers for the cost-benefit comparator (DEC-283/DEC-284), extracted
 * from `ComparatorPage` so the photo-extraction → row mapping is testable in
 * isolation (no React) — the E10 · DEC-330 guard that a read maps to a row and a
 * failure maps to a review row, never a silent drop.
 */
export interface Row {
  id: string;
  label: string;
  price: string;
  quantity: string;
  unit: string;
  /** DEC-284: a photo-filled row the user should confirm before trusting. */
  review?: boolean;
}

/** The comparator holds up to 6 rows (matches the picker + the seed cap). */
export const MAX_ROWS = 6;

/** A row carries data once the user (or a photo) gave it a price/qty/label. */
export function isFilledRow(row: Row): boolean {
  return row.price.trim() !== '' || row.quantity.trim() !== '' || row.label.trim() !== '';
}

/**
 * DEC-284: map one photo extraction outcome to a comparator row. A transport
 * failure becomes an empty row flagged for review, so a partial batch never
 * aborts — the user just fills that one by hand (E10 · DEC-330: no silent drop).
 */
export function outcomeToRow(outcome: UnitExtractOutcome, id: string): Row {
  if (!outcome.ok) return { id, label: '', price: '', quantity: '', unit: 'g', review: true };
  const item = outcome.item;
  return {
    id,
    label: item.label ?? '',
    price: item.price !== null ? String(item.price) : '',
    quantity: item.quantity !== null ? String(item.quantity) : '',
    unit: item.unit ?? 'g',
    review: item.needsReview,
  };
}
