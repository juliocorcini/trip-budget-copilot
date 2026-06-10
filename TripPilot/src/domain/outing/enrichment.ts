/**
 * Post-add enrichment stepper (DEC-078 / FIELD-08).
 *
 * After a quick-add tap the transaction is ALREADY saved (Core Rule:
 * logging never blocks). The stepper offers up to 3 optional micro-steps
 * — category, payer, split — each one tap, auto-dismissing when idle.
 */

/** Idle time before the stepper disappears (spec: 3s without interaction). */
export const ENRICH_AUTO_DISMISS_MS = 3000;

export type EnrichStep = 'category' | 'payer' | 'split';

/**
 * Fixed category sets per session profile category (data-driven, DEC-078).
 * Example from the field report: bar → drink/food/transport/ticket/other.
 */
const ENRICH_CATEGORY_SETS: Record<string, string[]> = {
  bar: ['bar', 'restaurant', 'transport', 'entertainment', 'other'],
  restaurant: ['restaurant', 'bar', 'transport', 'market', 'other'],
  festival: ['festival', 'bar', 'restaurant', 'transport', 'other'],
  market: ['market', 'restaurant', 'transport', 'other'],
  outing: ['outing', 'bar', 'restaurant', 'transport', 'other'],
};

const DEFAULT_ENRICH_CATEGORIES = ['restaurant', 'bar', 'transport', 'entertainment', 'other'];

/** Category options shown in step 1, scoped to the session's profile. */
export function getEnrichmentCategories(profileCategory: string | null): string[] {
  if (profileCategory === null) return DEFAULT_ENRICH_CATEGORIES;
  return ENRICH_CATEGORY_SETS[profileCategory] ?? DEFAULT_ENRICH_CATEGORIES;
}
