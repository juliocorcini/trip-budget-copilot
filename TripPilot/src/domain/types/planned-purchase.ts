import type { SyncMetadata } from './common';

/**
 * DEC-175: lifecycle of a planned purchase.
 * - `planned`  — open; its remaining reserve deducts from the fund's free-to-spend.
 * - `bought`   — fully acquired (remaining reserve reached 0 or user closed it);
 *                only the linked real expenses count from here on.
 * - `cancelled`— abandoned; reserves nothing, logs nothing.
 */
export type PlannedPurchaseStatus = 'planned' | 'bought' | 'cancelled';

/**
 * DEC-175: a known, intended future purchase the user wants to earmark NOW
 * (e.g. "skincare creams across stores", "clothes at some point") so the chosen
 * fund's free-to-spend already reflects it. Distinct from PlannedOccurrence
 * (dated, session/occasion-bound) — a purchase is usually trip-wide and undated,
 * and converts to a real expense via "Comprei" instead of starting a session.
 */
export interface PlannedPurchase extends SyncMetadata {
  tripId: string;
  /** The fund this draws from; its free-to-spend (or available) reflects the reserve. */
  budgetPoolId: string;
  name: string;
  /** A QuickAdd category key — pre-fills the "Comprei" form. */
  category: string;
  estimatedCostCents: number;
  /**
   * Amount that deducts from the fund's free-to-spend while `planned`. The
   * EFFECTIVE reserve shrinks by real linked spend (no double counting). `null`
   * = track only (visible plan, no reservation).
   */
  reservedCents: number | null;
  status: PlannedPurchaseStatus;
  /** Real expenses logged via "Comprei" — supports partial / multi-store buys. */
  linkedTransactionIds: string[];
  /** Optional hint where it will be bought ("Farmácia", "Primor"). */
  store: string | null;
  /** Optional "by when" target (ISO date). Never required — not an event. */
  targetDate: string | null;
  notes: string | null;
  /** Optional phase association; null = trip-wide. */
  phaseId: string | null;
}
