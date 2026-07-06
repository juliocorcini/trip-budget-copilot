/**
 * DEC-473 — receipt classification for the expenses screen tabs.
 *
 * A scanned note ("nota") is persisted exactly like an outing: ONE completed
 * Session holding N expense transactions. What tells the two apart is the
 * `externalRef` its transactions carry (`receipt:<sessionId>:<index>`, stamped
 * by `commitReceipt`). These pure helpers let the list split "Saídas" (bar
 * mode / registered outings) from "Notas" (scanned receipts) with no schema
 * change and full retro-compatibility.
 */

/** Transactions committed from a scanned receipt carry this `externalRef` prefix (DEC-206 G2). */
export const RECEIPT_REF_PREFIX = 'receipt:';

/** True when a transaction was created by committing a scanned receipt. */
export function isReceiptCommitTransaction(tx: { externalRef?: string | null }): boolean {
  return typeof tx.externalRef === 'string' && tx.externalRef.startsWith(RECEIPT_REF_PREFIX);
}

/**
 * The ids of sessions born from a receipt commit — i.e. the sessions whose
 * items carry the receipt ref. Structural input so the feed/list can call it
 * without importing the Transaction entity. Soft-deleted rows are the caller's
 * concern (the list already works on live transactions).
 */
export function collectReceiptSessionIds(
  transactions: ReadonlyArray<{ externalRef?: string | null; sessionId?: string | null }>,
): Set<string> {
  const ids = new Set<string>();
  for (const tx of transactions) {
    if (tx.sessionId && isReceiptCommitTransaction(tx)) ids.add(tx.sessionId);
  }
  return ids;
}
