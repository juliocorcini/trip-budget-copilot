import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  allocateBasketDiscount,
  applyBasketDiscountToReceiptPlan,
  parseReceiptResponse,
} from '@/domain/receipt';
import type { ReceiptDraftItem, ReceiptPlan } from '@/domain/receipt';

// DEC-467: a receipt-wide discount (coupon/promo before the total) is spread
// across the items proportionally to price, in integer cents, via the Largest
// Remainder Method. The math is deterministic code — the vision model only
// classifies the lines. Every test here checks concrete cents.

function draftItem(overrides: Partial<ReceiptDraftItem> & { amountCents: number }): ReceiptDraftItem {
  return {
    id: uuidv4(),
    description: 'Item',
    qty: 1,
    category: 'market',
    include: true,
    participantIds: [],
    paidByParticipantId: null,
    ...overrides,
  };
}

function planWith(
  items: ReceiptDraftItem[],
  overrides: Partial<ReceiptPlan> = {},
): ReceiptPlan {
  return {
    merchant: 'Mercadona',
    placeLabel: null,
    purchaseDate: null,
    currency: 'EUR',
    readTotalCents: null,
    items,
    serviceCharge: { amountCents: null, percent: null, included: null },
    adjustments: [],
    ...overrides,
  };
}

describe('allocateBasketDiscount (DEC-467)', () => {
  // Julio's real Spanish supermarket receipt: 6 lines, subtotal €17.92,
  // basket discount €4.05, paid €13.87. Expected proportional allocation.
  const julioGross = [660, 398, 270, 229, 199, 36];

  it("allocates Julio's receipt exactly (17.92 - 4.05 = 13.87)", () => {
    const result = allocateBasketDiscount(julioGross, 405);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.discountCentsByItem).toEqual([149, 90, 61, 52, 45, 8]);
    expect(result.allocatedCents).toBe(405);

    const nets = julioGross.map((gross, i) => gross - result.discountCentsByItem[i]!);
    expect(nets).toEqual([511, 308, 209, 177, 154, 28]);
    expect(nets.reduce((a, b) => a + b, 0)).toBe(1387);
  });

  it('distributes leftover cents to the largest remainders (never equal-per-line)', () => {
    // 3 items, discount 100: exact thirds are impossible — LRM decides.
    // bases: floor(100*500/1000)=50, floor(100*300/1000)=30, floor(100*200/1000)=20 → sums 100, no leftover.
    const clean = allocateBasketDiscount([500, 300, 200], 100);
    expect(clean.ok && clean.discountCentsByItem).toEqual([50, 30, 20]);

    // Now force remainders: discount 101 over the same grosses.
    // numerators: 50500, 30300, 20200 → bases 50,30,20 (sum 100), remainders 500,300,200 → extra cent → item 0.
    const withRemainder = allocateBasketDiscount([500, 300, 200], 101);
    expect(withRemainder.ok && withRemainder.discountCentsByItem).toEqual([51, 30, 20]);
  });

  it('breaks remainder ties by original item order', () => {
    // Two identical items, discount 1: both remainders equal → first item wins.
    const result = allocateBasketDiscount([100, 100], 1);
    expect(result.ok && result.discountCentsByItem).toEqual([1, 0]);
  });

  it('restricts allocation to eligible indexes', () => {
    const result = allocateBasketDiscount([500, 500, 1000], 150, [0, 2]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Eligible subtotal 1500: item0 = 150*500/1500 = 50, item2 = 100; item1 untouched.
    expect(result.discountCentsByItem).toEqual([50, 0, 100]);
  });

  it('rejects a discount larger than the eligible subtotal', () => {
    const result = allocateBasketDiscount([500, 300], 801);
    expect(result).toEqual({ ok: false, error: 'discount_exceeds_subtotal' });
  });

  it('rejects non-integer or non-positive discounts and invalid items', () => {
    expect(allocateBasketDiscount([100], 0)).toEqual({ ok: false, error: 'invalid_discount' });
    expect(allocateBasketDiscount([100], 10.5)).toEqual({ ok: false, error: 'invalid_discount' });
    expect(allocateBasketDiscount([100.7], 10)).toEqual({ ok: false, error: 'invalid_item' });
    expect(allocateBasketDiscount([], 10)).toEqual({ ok: false, error: 'nothing_eligible' });
  });

  it('property: allocation always sums exactly to the discount (fuzz)', () => {
    // Deterministic pseudo-random fuzz across sizes/values.
    let seed = 42;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };
    for (let run = 0; run < 200; run += 1) {
      const count = 1 + rand(8);
      const gross = Array.from({ length: count }, () => 1 + rand(5000));
      const subtotal = gross.reduce((a, b) => a + b, 0);
      const discount = 1 + rand(subtotal);
      const result = allocateBasketDiscount(gross, discount);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.discountCentsByItem.reduce((a, b) => a + b, 0)).toBe(discount);
      result.discountCentsByItem.forEach((cents, i) => {
        expect(cents).toBeGreaterThanOrEqual(0);
        expect(cents).toBeLessThanOrEqual(gross[i]!);
      });
    }
  });
});

describe('applyBasketDiscountToReceiptPlan (DEC-467)', () => {
  it("applies Julio's receipt end-to-end: nets sum to the paid total", () => {
    const plan = planWith(
      [660, 398, 270, 229, 199, 36].map((amountCents) => draftItem({ amountCents })),
      {
        readTotalCents: 1387,
        adjustments: [
          { kind: 'discount', label: 'DTO. TARJETA', amountCents: -405, scope: 'basket', itemIndex: null },
        ],
      },
    );

    const outcome = applyBasketDiscountToReceiptPlan(plan);
    expect(outcome.applied).toBe(true);
    expect(outcome.appliedDiscountCents).toBe(405);

    const nets = outcome.plan.items.map((i) => i.amountCents);
    expect(nets).toEqual([511, 308, 209, 177, 154, 28]);
    expect(nets.reduce((a, b) => a + b, 0)).toBe(1387);

    // Audit trail on every touched line.
    expect(outcome.plan.items[0]!.grossAmountCents).toBe(660);
    expect(outcome.plan.items[0]!.basketDiscountCents).toBe(149);

    // The consumed discount leaves the adjustments (no double-rating in split).
    expect(outcome.plan.adjustments).toHaveLength(0);
  });

  it('refuses to apply when the money equation does not close against the printed total', () => {
    // Model read the PRE-discount subtotal as "total" → 17.92 ≠ 17.92 - 4.05.
    const plan = planWith(
      [660, 398, 270, 229, 199, 36].map((amountCents) => draftItem({ amountCents })),
      {
        readTotalCents: 1792,
        adjustments: [{ kind: 'discount', label: 'DTO', amountCents: -405, scope: 'basket', itemIndex: null }],
      },
    );
    const outcome = applyBasketDiscountToReceiptPlan(plan);
    expect(outcome.applied).toBe(false);
    expect(outcome.plan).toBe(plan);
  });

  it('applies without a printed total (trusts the classified discount)', () => {
    const plan = planWith([draftItem({ amountCents: 1000 }), draftItem({ amountCents: 500 })], {
      readTotalCents: null,
      adjustments: [{ kind: 'discount', label: 'promo', amountCents: -150, scope: 'basket', itemIndex: null }],
    });
    const outcome = applyBasketDiscountToReceiptPlan(plan);
    expect(outcome.applied).toBe(true);
    expect(outcome.plan.items.map((i) => i.amountCents)).toEqual([900, 450]);
  });

  it('tolerates ±2¢ of OCR rounding noise on the printed total', () => {
    const plan = planWith([draftItem({ amountCents: 1000 })], {
      readTotalCents: 899, // exact would be 900
      adjustments: [{ kind: 'discount', label: 'promo', amountCents: -100, scope: 'basket', itemIndex: null }],
    });
    expect(applyBasketDiscountToReceiptPlan(plan).applied).toBe(true);
  });

  it('applies an item-scoped discount to ONLY that line', () => {
    const plan = planWith([draftItem({ amountCents: 500 }), draftItem({ amountCents: 300 })], {
      readTotalCents: 700,
      adjustments: [{ kind: 'discount', label: '2a unidad 50%', amountCents: -100, scope: 'item', itemIndex: 0 }],
    });
    const outcome = applyBasketDiscountToReceiptPlan(plan);
    expect(outcome.applied).toBe(true);
    expect(outcome.plan.items.map((i) => i.amountCents)).toEqual([400, 300]);
    expect(outcome.plan.items[1]!.basketDiscountCents).toBeUndefined();
  });

  it('stacks item + basket discounts in cashier order (item first, basket over the remainder)', () => {
    const plan = planWith([draftItem({ amountCents: 600 }), draftItem({ amountCents: 400 })], {
      readTotalCents: 800, // 1000 - 100 (item) - 100 (basket)
      adjustments: [
        { kind: 'discount', label: 'item promo', amountCents: -100, scope: 'item', itemIndex: 0 },
        { kind: 'discount', label: 'cupón', amountCents: -100, scope: 'basket', itemIndex: null },
      ],
    });
    const outcome = applyBasketDiscountToReceiptPlan(plan);
    expect(outcome.applied).toBe(true);
    // After item discount: [500, 400]. Basket 100 over 900 → floor(55.55)=55 r500, floor(44.44)=44 r400 → +1 → 56, 44.
    expect(outcome.plan.items.map((i) => i.amountCents)).toEqual([444, 356]);
    expect(outcome.plan.items.map((i) => i.amountCents).reduce((a, b) => a + b, 0)).toBe(800);
  });

  it('never applies a discount larger than the subtotal', () => {
    const plan = planWith([draftItem({ amountCents: 300 })], {
      adjustments: [{ kind: 'discount', label: 'promo', amountCents: -400, scope: 'basket', itemIndex: null }],
    });
    const outcome = applyBasketDiscountToReceiptPlan(plan);
    expect(outcome.applied).toBe(false);
  });

  it('keeps couvert/other adjustments untouched while consuming discounts', () => {
    const plan = planWith([draftItem({ amountCents: 1000 })], {
      readTotalCents: null,
      adjustments: [
        { kind: 'couvert', label: 'couvert', amountCents: 300 },
        { kind: 'discount', label: 'promo', amountCents: -100, scope: 'basket', itemIndex: null },
      ],
    });
    const outcome = applyBasketDiscountToReceiptPlan(plan);
    expect(outcome.applied).toBe(true);
    expect(outcome.plan.adjustments).toEqual([{ kind: 'couvert', label: 'couvert', amountCents: 300 }]);
  });

  it('no-ops when there are no discounts', () => {
    const plan = planWith([draftItem({ amountCents: 1000 })]);
    const outcome = applyBasketDiscountToReceiptPlan(plan);
    expect(outcome.applied).toBe(false);
    expect(outcome.plan).toBe(plan);
  });
});

describe('parseAdjustments scope plumbing (DEC-467)', () => {
  it('parses scope/itemIndex from the OCR response and defaults discounts to basket', () => {
    const plan = parseReceiptResponse({
      total: 13.87,
      items: [
        { description: 'Cerveza', qty: 6, unitPrice: 1.1, lineTotal: 6.6 },
        { description: 'Pan', qty: 1, unitPrice: 0.36, lineTotal: 0.36 },
      ],
      adjustments: [
        { kind: 'discount', label: 'DTO', amount: -4.05 }, // no scope → basket
        { kind: 'discount', label: '2a un.', amount: -0.5, scope: 'item', itemIndex: 0 },
        { kind: 'discount', label: 'bad idx', amount: -0.2, scope: 'item', itemIndex: 9 }, // → basket
        { kind: 'couvert', label: 'cover', amount: 2 }, // non-discount: no scope added
      ],
    });

    expect(plan.adjustments[0]).toMatchObject({ scope: 'basket', itemIndex: null, amountCents: -405 });
    expect(plan.adjustments[1]).toMatchObject({ scope: 'item', itemIndex: 0, amountCents: -50 });
    expect(plan.adjustments[2]).toMatchObject({ scope: 'basket', itemIndex: null });
    expect(plan.adjustments[3]!.scope).toBeUndefined();
  });

  it("full pipeline on Julio's receipt shape: parse → apply → nets match the paid total", () => {
    const raw = {
      merchant: 'SUPERMERCADO',
      currency: 'EUR',
      total: 13.87,
      items: [
        { description: 'Cerveza', qty: 6, unitPrice: 1.1, lineTotal: 6.6 },
        { description: 'Hummus', qty: 2, unitPrice: 1.99, lineTotal: 3.98 },
        { description: 'Tortilla', qty: 2, unitPrice: 1.35, lineTotal: 2.7 },
        { description: 'Queso', qty: 1, unitPrice: 2.29, lineTotal: 2.29 },
        { description: 'Jamón', qty: 1, unitPrice: 1.99, lineTotal: 1.99 },
        { description: 'Pan', qty: 1, unitPrice: 0.36, lineTotal: 0.36 },
      ],
      // The model must NOT emit "ACUMULADO CLUB 0.18" nor "TOTAL VENTAJAS 4.23"
      // here (prompt rule); only the true purchase discount arrives.
      adjustments: [{ kind: 'discount', label: 'DTO. TARJETA', amount: -4.05, scope: 'basket', itemIndex: null }],
    };

    const outcome = applyBasketDiscountToReceiptPlan(parseReceiptResponse(raw));
    expect(outcome.applied).toBe(true);

    const nets = outcome.plan.items.map((i) => i.amountCents);
    expect(nets).toEqual([511, 308, 209, 177, 154, 28]);
    expect(nets.reduce((a, b) => a + b, 0)).toBe(outcome.plan.readTotalCents);
  });
});
