import { parseLocaleNumber } from '@/domain/money';

/**
 * E6 (M21): Web Share Target intake. When the OS shares text/URL into TripPilot
 * (manifest share_target → /quick-add?title&text&url), we PRE-FILL the quick-add
 * form — never auto-save (ÂNCORA 13). This parser is pure so it is fully tested.
 */

export interface SharedExpenseIntake {
  /** First money-like number found, or null when none is present. */
  amount: number | null;
  /** Best-effort description (title, then text, then url). */
  description: string;
}

// A money-ish token: grouped thousands (1.234,56 / 1,234.56) OR a plain number
// with optional 1–2 decimals (12 / 12.50 / 12,5). parseLocaleNumber normalizes.
const AMOUNT_RE = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/;

export function parseSharedExpense(input: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): SharedExpenseIntake {
  const title = (input.title ?? '').trim();
  const text = (input.text ?? '').trim();
  const url = (input.url ?? '').trim();

  const haystack = [title, text].filter((part) => part !== '').join(' ');
  const match = haystack.match(AMOUNT_RE);
  const parsed = match ? parseLocaleNumber(match[0]) : null;
  const amount = parsed !== null && parsed > 0 ? parsed : null;

  return { amount, description: title || text || url };
}
