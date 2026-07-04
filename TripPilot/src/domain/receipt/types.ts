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
  /**
   * DEC-467 — audit trail when a basket-level discount was folded into this
   * line: the printed (pre-discount) line total. Absent when no discount hit it.
   */
  grossAmountCents?: number;
  /** DEC-467 — this line's proportional share of the basket discount (cents ≥ 0). */
  basketDiscountCents?: number;
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

/**
 * T3 — the service charge the OCR could read off the bill, normalised to cents.
 * Raw, pre-decision read: the split domain (`detectServiceCharge`) decides the
 * mode/source and whether the user must still be asked. All fields null when the
 * receipt mentions no service.
 */
export interface ReceiptServiceCharge {
  /** Absolute service amount in cents, when printed. */
  amountCents: number | null;
  /** Percentage of the items subtotal, when printed as a rate. */
  percent: number | null;
  /** true = already inside the printed total; false = added on top; null = unknown. */
  included: boolean | null;
}

/** E6 — a non-product money line the OCR read (couvert / discount / other). */
export interface ReceiptAdjustment {
  kind: 'couvert' | 'discount' | 'other';
  label: string;
  /** Cents — negative for a discount (a credit), positive for couvert/other. */
  amountCents: number;
  /**
   * DEC-467 — what the discount applies to: the whole purchase ('basket') or a
   * single line ('item', with `itemIndex` pointing into `items`). Older reads
   * without the field are treated as 'basket' by the applier.
   */
  scope?: 'basket' | 'item';
  /** Index into `ReceiptPlan.items` when scope === 'item'; null/absent otherwise. */
  itemIndex?: number | null;
}

/** The normalised, cents-based receipt ready for review/split/commit. */
export interface ReceiptPlan {
  merchant: string | null;
  /** Best-effort place label: the model's printed location, else derived from the merchant string. */
  placeLabel: string | null;
  /**
   * FB-10 (DEC-258): the purchase date printed on the receipt, as a strict
   * `YYYY-MM-DD` calendar day (null when absent/unreadable). The commit turns it
   * into the transaction date so a receipt-sourced expense lands on the day it
   * happened, not the day it was scanned.
   */
  purchaseDate: string | null;
  /** ISO 4217 code when the provider could read it, else null. */
  currency: string | null;
  /** Final amount printed on the receipt, for reconciliation (null when absent). */
  readTotalCents: number | null;
  items: ReceiptDraftItem[];
  /** T3 — service charge read off the bill (null fields when none was found). */
  serviceCharge: ReceiptServiceCharge;
  /** E6 — non-product money lines read off the bill (couvert/discount/other). */
  adjustments: ReceiptAdjustment[];
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
