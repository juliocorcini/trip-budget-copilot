import { afterEach, describe, it, expect } from 'vitest';
import {
  setReceiptSplitHandoff,
  takeReceiptSplitHandoff,
  hasPendingReceiptSplitHandoff,
} from '@/features/split/receipt-split-handoff';
import { parseReceiptResponse } from '@/domain/receipt';

// B1 (audit §2.1): the receipt→split bridge is a single-use in-memory slot. The
// contract that matters: a bill set on the receipt screen is readable EXACTLY
// once by the split screen, and a stale handoff never leaks into a later manual
// open of the split flow.

const plan = parseReceiptResponse({
  merchant: 'Trattoria',
  currency: 'EUR',
  total: 80,
  items: [{ description: 'Pizza', qty: 1, lineTotal: 80 }],
});

afterEach(() => {
  // Drain any handoff a failing test might have left pending.
  takeReceiptSplitHandoff();
});

describe('receipt → split handoff (B1)', () => {
  it('reports nothing pending before anything is set', () => {
    expect(hasPendingReceiptSplitHandoff()).toBe(false);
    expect(takeReceiptSplitHandoff()).toBeNull();
  });

  it('peeks without consuming, then take() returns the bill once', () => {
    setReceiptSplitHandoff({ plan, image: null });

    // Peek must not consume — the split screen checks this on every render.
    expect(hasPendingReceiptSplitHandoff()).toBe(true);
    expect(hasPendingReceiptSplitHandoff()).toBe(true);

    const taken = takeReceiptSplitHandoff();
    expect(taken).not.toBeNull();
    expect(taken!.plan.merchant).toBe('Trattoria');
    expect(taken!.plan.items).toHaveLength(1);
    expect(taken!.image).toBeNull();
  });

  it('is single-use — a second take() after consuming returns null', () => {
    setReceiptSplitHandoff({ plan, image: null });
    expect(takeReceiptSplitHandoff()).not.toBeNull();

    expect(hasPendingReceiptSplitHandoff()).toBe(false);
    expect(takeReceiptSplitHandoff()).toBeNull();
  });

  it('a newer set() overwrites an unconsumed handoff (last bill wins)', () => {
    setReceiptSplitHandoff({ plan, image: null });
    const second = parseReceiptResponse({
      merchant: 'Bar do Zé',
      currency: 'BRL',
      total: 30,
      items: [{ description: 'Cerveja', qty: 1, lineTotal: 30 }],
    });
    setReceiptSplitHandoff({ plan: second, image: null });

    const taken = takeReceiptSplitHandoff();
    expect(taken!.plan.merchant).toBe('Bar do Zé');
    expect(taken!.plan.currency).toBe('BRL');
  });
});
