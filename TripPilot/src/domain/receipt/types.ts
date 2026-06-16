/**
 * DEC-206 (G2): receipt OCR domain types.
 *
 * The OCR provider (cloud Groq today, on-device tomorrow) returns a loose,
 * decimal-based shape. The domain parser converts it into a `ReceiptPlan` — a
 * fully cents-based, reviewable structure that mirrors the Wise import mold:
 * every line is a toggle-able draft the user confirms/splits before commit.
 */

/** One reviewable receipt line. `amountCents` is the line total that becomes the expense. */
export interface ReceiptDraftItem {
  id: string;
  description: string;
  /** Printed quantity (defaults to 1 when absent/invalid). */
  qty: number;
  /** Line total in cents — the amount registered for this expense. */
  amountCents: number;
  category: string;
  /** Whether this line is kept on commit (user can drop noise lines). */
  include: boolean;
  /**
   * Split config. Empty = personal (the owner consumes and pays). When set,
   * the cost is divided equally among these participants via resolvePayerExpense.
   */
  participantIds: string[];
  /** Who handed over the money for this line; null = the owner. */
  paidByParticipantId: string | null;
}

/** The normalised, cents-based receipt ready for review/split/commit. */
export interface ReceiptPlan {
  merchant: string | null;
  /** Best-effort place label derived from the merchant string (session flavour). */
  placeLabel: string | null;
  /** ISO 4217 code when the provider could read it, else null. */
  currency: string | null;
  /** Final amount printed on the receipt, for reconciliation (null when absent). */
  readTotalCents: number | null;
  items: ReceiptDraftItem[];
}

/** Informational comparison between the kept items and the printed total. */
export interface ReceiptReconciliation {
  /** Sum of INCLUDED item amounts (cents). */
  itemsTotalCents: number;
  readTotalCents: number | null;
  /** itemsTotal - readTotal (null when the receipt had no total). */
  diffCents: number | null;
  /** True when the difference is within tolerance (or there is no total to match). */
  matches: boolean;
}
