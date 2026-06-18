import { describe, it, expect } from 'vitest';
import { buildSplitFromReceipt } from '@/domain/split';
import { parseReceiptResponse } from '@/domain/receipt';
import type { BuildSplitFromReceiptInput } from '@/domain/split';

// T3/E6 (M4): buildSplitFromReceipt is the capture step's pure core — it turns an
// OCR'd ReceiptPlan into a divisible SplitSession (items + resolved service
// charge + adjustments). Plans are built through parseReceiptResponse so the
// whole OCR→split mapping is exercised end-to-end.

const INPUT: BuildSplitFromReceiptInput = {
  tripId: 'trip-1',
  phaseId: 'phase-1',
  ownerName: 'Eu',
  fallbackCurrency: 'BRL',
  ownerActorId: null,
};

describe('buildSplitFromReceipt (T3/E6)', () => {
  it('maps kept positive lines to claimable items and carries name/currency/total', () => {
    const plan = parseReceiptResponse({
      merchant: 'Trattoria',
      currency: 'EUR',
      total: 80,
      items: [
        { description: 'Pizza', qty: 1, lineTotal: 60 },
        { description: 'Cerveja', qty: 1, lineTotal: 20 },
      ],
    });
    const { session } = buildSplitFromReceipt(plan, INPUT);

    expect(session.name).toBe('Trattoria');
    expect(session.currency).toBe('EUR');
    expect(session.readTotalCents).toBe(8000);
    expect(session.items).toHaveLength(2);
    expect(session.items.every((i) => i.claims.length === 0)).toBe(true);
    expect(session.participants).toHaveLength(1);
    expect(session.participants[0]!.kind).toBe('owner');
    expect(session.participants[0]!.name).toBe('Eu');
  });

  it('resolves a detected absolute service charge to a proportional charge (no prompt)', () => {
    const plan = parseReceiptResponse({
      currency: 'EUR',
      items: [{ description: 'A', lineTotal: 80 }],
      serviceCharge: { amount: 8, percent: null, included: false },
    });
    const { session, needsServiceChargePrompt } = buildSplitFromReceipt(plan, INPUT);

    expect(needsServiceChargePrompt).toBe(false);
    expect(session.serviceCharge.mode).toBe('proportional');
    expect(session.serviceCharge.source).toBe('detected');
    expect(session.serviceCharge.amountCents).toBe(800);
  });

  it('resolves a percentage service charge against the items subtotal', () => {
    const plan = parseReceiptResponse({
      items: [
        { description: 'A', lineTotal: 30 },
        { description: 'B', lineTotal: 20 },
      ],
      serviceCharge: { amount: null, percent: 10, included: false },
    });
    const { session } = buildSplitFromReceipt(plan, INPUT);

    // 10% of the 50.00 subtotal = 5.00.
    expect(session.serviceCharge.amountCents).toBe(500);
    expect(session.serviceCharge.percent).toBe(10);
    expect(session.serviceCharge.source).toBe('detected');
  });

  it('infers an included service charge when the total sits 8–15% above the items', () => {
    const plan = parseReceiptResponse({
      total: 11, // 10.00 items + 1.00 gap = 10%
      items: [{ description: 'A', lineTotal: 10 }],
    });
    const { session, needsServiceChargePrompt } = buildSplitFromReceipt(plan, INPUT);

    expect(needsServiceChargePrompt).toBe(false);
    expect(session.serviceCharge.source).toBe('inferred_included');
    expect(session.serviceCharge.amountCents).toBe(100);
  });

  it('flags that it must ASK when nothing is detected and the total matches the items', () => {
    const plan = parseReceiptResponse({
      total: 10,
      items: [{ description: 'A', lineTotal: 10 }],
    });
    const { session, needsServiceChargePrompt } = buildSplitFromReceipt(plan, INPUT);

    expect(needsServiceChargePrompt).toBe(true);
    expect(session.serviceCharge.mode).toBe('none');
    expect(session.serviceCharge.source).toBe('asked');
    expect(session.serviceCharge.amountCents).toBe(0);
  });

  it('maps adjustments with their default modes (couvert per-head, discount proportional)', () => {
    const plan = parseReceiptResponse({
      items: [{ description: 'A', lineTotal: 50 }],
      adjustments: [
        { kind: 'couvert', label: 'Couvert', amount: 4 },
        { kind: 'discount', label: 'Promo', amount: 3 },
      ],
    });
    const { session } = buildSplitFromReceipt(plan, INPUT);

    expect(session.adjustments).toHaveLength(2);
    const couvert = session.adjustments.find((a) => a.kind === 'couvert')!;
    const discount = session.adjustments.find((a) => a.kind === 'discount')!;
    expect(couvert.mode).toBe('per_head');
    expect(couvert.amountCents).toBe(400);
    expect(couvert.source).toBe('detected');
    expect(discount.mode).toBe('proportional');
    expect(discount.amountCents).toBe(-300); // discount is a credit
  });

  it('falls back to the trip currency and a default name when the OCR read neither', () => {
    const plan = parseReceiptResponse({ items: [{ description: 'A', lineTotal: 10 }] });
    const { session } = buildSplitFromReceipt(plan, INPUT);

    expect(session.currency).toBe('BRL');
    expect(session.name).toBe('Conta');
  });

  it('drops excluded lines before building items', () => {
    const base = parseReceiptResponse({
      items: [
        { description: 'Keep', lineTotal: 10 },
        { description: 'Drop', lineTotal: 5 },
      ],
    });
    const plan = { ...base, items: base.items.map((i, idx) => (idx === 1 ? { ...i, include: false } : i)) };
    const { session } = buildSplitFromReceipt(plan, INPUT);

    expect(session.items).toHaveLength(1);
    expect(session.items[0]!.description).toBe('Keep');
  });
});
