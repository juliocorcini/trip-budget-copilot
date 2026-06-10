/**
 * Post-add enrichment stepper (DEC-078 / FIELD-08, reworked by DEC-095/096).
 *
 * After a quick-add tap the transaction is ALREADY saved (Core Rule:
 * logging never blocks). The stepper offers optional micro-steps — each
 * one tap, auto-dismissing when idle.
 *
 * DEC-095 (R-13): the "what was it" step offers SUBCATEGORIES of the
 * outing type (see expense-taxonomy.ts), not outing types.
 * DEC-096 (R-17): event sessions ask the context first (level 1), then
 * the subcategories of that context (level 2).
 */

/** DEC-096 (R-14): idle time before the stepper disappears — was 3s,
 * the field report could not tap it in time. Interaction resets it. */
export const ENRICH_AUTO_DISMISS_MS = 10000;

export type EnrichStep = 'context' | 'category' | 'payer' | 'split';
