import { afterEach, describe, it, expect } from 'vitest';
import {
  setReceiptReviewHandoff,
  takeReceiptReviewHandoff,
  hasPendingReceiptReviewHandoff,
} from '@/features/receipt/receipt-review-handoff';
import { parseReceiptResponse } from '@/domain/receipt';

// FB-09 (DEC-258): the assistant→receipt "open items" bridge is a single-use
// in-memory slot. The contract that matters: a plan scanned INSIDE the assistant
// is readable EXACTLY once by the receipt screen (so no second OCR), and a stale
// handoff never leaks into a later manual open of the scanner.

const plan = parseReceiptResponse({
  merchant: 'Trattoria',
  currency: 'EUR',
  total: 80,
  items: [{ description: 'Pizza', qty: 1, lineTotal: 80 }],
});

afterEach(() => {
  // Drain any handoff a failing test might have left pending.
  takeReceiptReviewHandoff();
});

describe('assistant → receipt review handoff (FB-09)', () => {
  it('reports nothing pending before anything is set', () => {
    expect(hasPendingReceiptReviewHandoff()).toBe(false);
    expect(takeReceiptReviewHandoff()).toBeNull();
  });

  it('peeks without consuming, then take() returns the plan + name once', () => {
    setReceiptReviewHandoff({ plan, image: null, name: 'Trattoria' });

    // Peek must not consume — the receipt screen checks this on mount.
    expect(hasPendingReceiptReviewHandoff()).toBe(true);
    expect(hasPendingReceiptReviewHandoff()).toBe(true);

    const taken = takeReceiptReviewHandoff();
    expect(taken).not.toBeNull();
    expect(taken!.plan.merchant).toBe('Trattoria');
    expect(taken!.plan.items).toHaveLength(1);
    expect(taken!.name).toBe('Trattoria');
    expect(taken!.image).toBeNull();
  });

  it('is single-use — a second take() after consuming returns null', () => {
    setReceiptReviewHandoff({ plan, image: null, name: null });
    expect(takeReceiptReviewHandoff()).not.toBeNull();

    expect(hasPendingReceiptReviewHandoff()).toBe(false);
    expect(takeReceiptReviewHandoff()).toBeNull();
  });

  it('a newer set() overwrites an unconsumed handoff (last scan wins)', () => {
    setReceiptReviewHandoff({ plan, image: null, name: 'Trattoria' });
    const second = parseReceiptResponse({
      merchant: 'Bar do Zé',
      currency: 'BRL',
      total: 30,
      items: [{ description: 'Cerveja', qty: 1, lineTotal: 30 }],
    });
    setReceiptReviewHandoff({ plan: second, image: null, name: 'Bar do Zé' });

    const taken = takeReceiptReviewHandoff();
    expect(taken!.plan.merchant).toBe('Bar do Zé');
    expect(taken!.plan.currency).toBe('BRL');
    expect(taken!.name).toBe('Bar do Zé');
  });
});
