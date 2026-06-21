import type { ReceiptPlan } from '@/domain/receipt';
import type { CompressedImage } from '@/utils/image/compress';

/**
 * B1 — the bridge that makes "Escanear nota" and "Dividir conta" feel like ONE
 * engine with two doors (audit §2.1). Both already share the same OCR; the only
 * missing link was that a bill scanned in the receipt door could not become a
 * LIVE/pass-the-phone table without re-scanning through the other door.
 *
 * After an OCR read on the receipt screen, the user can choose "Dividir ao vivo"
 * and we hand the ALREADY-parsed {@link ReceiptPlan} (plus the compressed photo,
 * so the attachment rides along) to {@link SplitPage}, which feeds it straight
 * into its existing `buildSplitFromReceipt` path — no second scan, no engine
 * rewrite. The draft lives in a tiny in-memory slot (this is a SPA — navigation
 * never reloads the module) and is consumed exactly once, so a later manual open
 * of the split screen never re-applies a stale bill. Nothing leaves the device.
 */
export interface ReceiptSplitHandoff {
  plan: ReceiptPlan;
  /** The compressed receipt photo, so the split commit can attach it too. */
  image: CompressedImage | null;
}

let pending: ReceiptSplitHandoff | null = null;

export function setReceiptSplitHandoff(handoff: ReceiptSplitHandoff): void {
  pending = handoff;
}

/** True when a bill is waiting to open as a live split (non-consuming peek). */
export function hasPendingReceiptSplitHandoff(): boolean {
  return pending !== null;
}

/** Reads AND clears the handoff (single-use), so a manual reopen never re-applies it. */
export function takeReceiptSplitHandoff(): ReceiptSplitHandoff | null {
  const handoff = pending;
  pending = null;
  return handoff;
}
