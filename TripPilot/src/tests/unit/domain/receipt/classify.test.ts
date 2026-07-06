import { describe, it, expect } from 'vitest';
import {
  RECEIPT_REF_PREFIX,
  isReceiptCommitTransaction,
  collectReceiptSessionIds,
} from '@/domain/receipt';

// DEC-473 — receipts ("Notas") get their own tab; the classifier reads the
// `receipt:` externalRef stamped by commitReceipt.

describe('isReceiptCommitTransaction', () => {
  it('recognizes the receipt ref and rejects everything else', () => {
    expect(isReceiptCommitTransaction({ externalRef: `${RECEIPT_REF_PREFIX}s1:0` })).toBe(true);
    expect(isReceiptCommitTransaction({ externalRef: 'split:s1' })).toBe(false);
    expect(isReceiptCommitTransaction({ externalRef: 'wise:row-3' })).toBe(false);
    expect(isReceiptCommitTransaction({ externalRef: null })).toBe(false);
    expect(isReceiptCommitTransaction({})).toBe(false);
  });
});

describe('collectReceiptSessionIds', () => {
  it('collects only sessions whose items carry the receipt ref', () => {
    const ids = collectReceiptSessionIds([
      { sessionId: 'receipt-session', externalRef: 'receipt:receipt-session:0' },
      { sessionId: 'receipt-session', externalRef: 'receipt:receipt-session:1' },
      { sessionId: 'bar-session', externalRef: null },
      { sessionId: 'split-session', externalRef: 'split:split-session' },
      { sessionId: null, externalRef: 'receipt:orphan:0' },
    ]);
    expect(ids).toEqual(new Set(['receipt-session']));
  });

  it('returns an empty set for a trip with no receipts', () => {
    expect(collectReceiptSessionIds([{ sessionId: 's1', externalRef: null }])).toEqual(new Set());
  });
});
