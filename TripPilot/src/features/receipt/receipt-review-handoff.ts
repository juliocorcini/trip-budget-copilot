import type { ReceiptPlan } from '@/domain/receipt';
import type { CompressedImage } from '@/utils/image/compress';

/**
 * FB-09 (C2 / DEC-258) — "abrir itens" hand-off. When a photo scanned INSIDE the
 * assistant should become the full item-by-item receipt instead of one summarized
 * expense, the assistant hands the ALREADY-extracted plan (and the compressed
 * photo) straight to `ReceiptScanPage` — no second OCR call, no token spent twice.
 * Held in a one-shot in-memory slot (this is a SPA; navigation never reloads the
 * module) and consumed exactly once, so opening the scanner manually later never
 * re-applies a stale plan. Nothing leaves the device.
 */
export interface ReceiptReviewHandoff {
  plan: ReceiptPlan;
  image: CompressedImage | null;
  /** Suggested note title (merchant), or null to let the page derive it. */
  name: string | null;
}

let pending: ReceiptReviewHandoff | null = null;

export function setReceiptReviewHandoff(handoff: ReceiptReviewHandoff): void {
  pending = handoff;
}

/** Reads AND clears the hand-off (single-use). */
export function takeReceiptReviewHandoff(): ReceiptReviewHandoff | null {
  const handoff = pending;
  pending = null;
  return handoff;
}

export function hasPendingReceiptReviewHandoff(): boolean {
  return pending !== null;
}
