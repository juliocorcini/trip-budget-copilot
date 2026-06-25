/**
 * D11/D14 · DEC-313/314 — the day's saving has exactly ONE destination, never two.
 *
 * The check-in used to claim both that a calm day's saving lifted the next days
 * (+X/day) AND that it went to the cofrinho — counting the same money twice. The
 * cofrinho math (Model B, `buildPiggyLedger`) already decides this: when a phase
 * has dates the saving DEPOSITS into the buffer (and that buffer is what protects
 * the days ahead), so there is no separate "+X/day" destination; only when there
 * is no cofrinho (an ongoing / no-date phase) does the saving dilute into the
 * remaining days. This pure selector names that single destination so the UI
 * shows one — and never highlights the cofrinho when the money did not go there.
 *
 * Pure (zero React, integer cents): the math is untouched (ÂNCORA 11); this only
 * labels what already happens.
 */
export type SavingDestination = 'piggy' | 'next_days' | 'none';

export interface SavingDestinationInput {
  /** The amount saved today (a calm / no-spend day's leftover), in cents. */
  savedCents: number;
  /** Whether an active cofrinho exists (a phase with dates → a buffer ledger). */
  piggyActive: boolean;
}

export function resolveSavingDestination(input: SavingDestinationInput): SavingDestination {
  if (input.savedCents <= 0) return 'none';
  return input.piggyActive ? 'piggy' : 'next_days';
}
