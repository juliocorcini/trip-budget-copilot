import type { AppMode } from '@/domain/types/common';

/**
 * E1 (M22): adaptive reveal. Once a simple-mode user has logged enough
 * expenses to be comfortable, offer (once) to unlock the complete mode.
 * Opt-in and dismissible — never forced (ÂNCORA 10).
 */
export const MODE_REVEAL_MIN_EXPENSES = 5;

export function shouldOfferModeReveal(
  appMode: AppMode,
  dismissed: boolean,
  expenseCount: number,
  threshold: number,
): boolean {
  return appMode === 'simple' && !dismissed && expenseCount >= threshold;
}
