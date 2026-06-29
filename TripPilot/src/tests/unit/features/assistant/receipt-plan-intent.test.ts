import { describe, it, expect } from 'vitest';
import { receiptPlanToIntent } from '@/features/assistant/useAssistant';
import type { ReceiptPlan, ReceiptDraftItem } from '@/domain/receipt';

/**
 * DEC-408 (G7) + FB-10 (DEC-258) parity: an OCR'd pasted image becomes ONE
 * `log_expense` intent that carries the receipt's real place/date and a factual
 * description — never the category as the text (DEC-403).
 */

function item(category: string, amountCents: number): ReceiptDraftItem {
  return {
    id: `i-${category}-${amountCents}`,
    description: category,
    qty: 1,
    amountCents,
    category,
    include: true,
    participantIds: [],
    paidByParticipantId: null,
  };
}

function plan(over: Partial<ReceiptPlan> = {}): ReceiptPlan {
  return {
    merchant: 'Trattoria Roma',
    placeLabel: 'Trattoria Roma, Lisboa',
    purchaseDate: '2026-06-20',
    currency: 'EUR',
    readTotalCents: 4200,
    items: [item('food', 3000), item('food', 1200)],
    serviceCharge: { amountCents: null, percent: null, included: null },
    adjustments: [],
    ...over,
  };
}

describe('receiptPlanToIntent (DEC-408 · G7)', () => {
  it('maps a receipt plan + summary to a log_expense intent', () => {
    const intent = receiptPlanToIntent(plan(), { amountCents: 4200, merchant: 'Trattoria Roma' });
    expect(intent.action).toBe('log_expense');
    expect(intent.amount).toBe(42);
    expect(intent.currency).toBe('EUR');
    expect(intent.description).toBe('Trattoria Roma');
    expect(intent.category).toBe('food');
  });

  it('carries the OCR place and purchase date (lands on the real venue/day)', () => {
    const intent = receiptPlanToIntent(plan({ placeLabel: 'Café Central', purchaseDate: '2026-01-02' }), {
      amountCents: 500,
      merchant: 'Café Central',
    });
    expect(intent.place).toBe('Café Central');
    expect(intent.date).toBe('2026-01-02');
  });

  it('never uses the category as the description (DEC-403): null merchant → null description', () => {
    const intent = receiptPlanToIntent(plan({ merchant: null }), { amountCents: 4200, merchant: null });
    expect(intent.description).toBeNull();
    expect(intent.description).not.toBe(intent.category);
  });

  it('passes through a null currency from an unreadable receipt', () => {
    const intent = receiptPlanToIntent(plan({ currency: null }), { amountCents: 100, merchant: 'X' });
    expect(intent.currency).toBeNull();
  });
});
