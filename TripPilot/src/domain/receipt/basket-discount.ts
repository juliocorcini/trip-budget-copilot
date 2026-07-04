import type { ReceiptAdjustment, ReceiptDraftItem, ReceiptPlan } from './types';

/**
 * DEC-467 — basket-level discount allocation.
 *
 * Some receipts apply a discount to the WHOLE purchase (a coupon, a promo card)
 * instead of to a single product line. The vision model only CLASSIFIES that
 * line (adjustments, kind 'discount'); the math is done here, deterministically:
 * the discount is spread across the items proportionally to each line's gross
 * value using the Largest Remainder Method over integer cents, so:
 *   - every item receives the same discount RATE (no equal-per-line splitting),
 *   - the allocated cents always sum EXACTLY to the discount,
 *   - net totals always sum EXACTLY to what was actually paid.
 *
 * Loyalty points / cashback / "accumulated for future purchases" lines are NOT
 * discounts of this purchase — the OCR prompt keeps them out of adjustments,
 * and the plan-level applier only consumes kind === 'discount' entries whose
 * math closes the equation: items subtotal − discounts = printed total paid.
 */

export interface BasketDiscountAllocation {
  /** Allocated discount per item, same order/length as the input items. */
  discountCentsByItem: number[];
  /** Sum of the allocations — always exactly the requested discount. */
  allocatedCents: number;
}

export type BasketDiscountError =
  /** Discount is not a positive safe integer of cents. */
  | 'invalid_discount'
  /** An item's gross is not a non-negative safe integer of cents. */
  | 'invalid_item'
  /** The discount exceeds the eligible items' subtotal. */
  | 'discount_exceeds_subtotal'
  /** No eligible item with a positive gross to allocate against. */
  | 'nothing_eligible';

export type BasketDiscountResult =
  | ({ ok: true } & BasketDiscountAllocation)
  | { ok: false; error: BasketDiscountError };

/**
 * Spread `discountCents` across `grossTotalsCents` proportionally (Largest
 * Remainder Method, integer cents). `eligibleIndexes` limits which lines share
 * the discount (null/omitted = all). Pure; never mutates the input.
 *
 * Rounding: base = floor(discount * gross / eligibleSubtotal) per item, then the
 * still-undistributed cents go one by one to the items with the largest
 * remainders (ties keep the original item order). Ineligible items always get 0.
 */
export function allocateBasketDiscount(
  grossTotalsCents: number[],
  discountCents: number,
  eligibleIndexes?: number[] | null,
): BasketDiscountResult {
  if (!Number.isSafeInteger(discountCents) || discountCents <= 0) {
    return { ok: false, error: 'invalid_discount' };
  }
  for (const gross of grossTotalsCents) {
    if (!Number.isSafeInteger(gross) || gross < 0) return { ok: false, error: 'invalid_item' };
  }

  const eligible = new Set(
    (eligibleIndexes ?? grossTotalsCents.map((_, index) => index)).filter(
      (index) => index >= 0 && index < grossTotalsCents.length,
    ),
  );

  const eligibleSubtotalCents = grossTotalsCents.reduce(
    (sum, gross, index) => (eligible.has(index) ? sum + gross : sum),
    0,
  );
  if (eligibleSubtotalCents <= 0) return { ok: false, error: 'nothing_eligible' };
  if (discountCents > eligibleSubtotalCents) {
    return { ok: false, error: 'discount_exceeds_subtotal' };
  }

  interface Share {
    index: number;
    baseCents: number;
    remainder: number;
  }

  const shares: Share[] = grossTotalsCents.map((gross, index) => {
    if (!eligible.has(index) || gross <= 0) return { index, baseCents: 0, remainder: 0 };
    const numerator = discountCents * gross;
    return {
      index,
      baseCents: Math.floor(numerator / eligibleSubtotalCents),
      remainder: numerator % eligibleSubtotalCents,
    };
  });

  let remainingCents = discountCents - shares.reduce((sum, share) => sum + share.baseCents, 0);

  // Hand the leftover cents to the largest remainders; ties keep item order.
  const byRemainder = shares
    .filter((share) => eligible.has(share.index) && grossTotalsCents[share.index]! > 0)
    .sort((a, b) => (b.remainder !== a.remainder ? b.remainder - a.remainder : a.index - b.index));
  for (let position = 0; remainingCents > 0 && byRemainder.length > 0; position += 1) {
    byRemainder[position % byRemainder.length]!.baseCents += 1;
    remainingCents -= 1;
  }

  const discountCentsByItem = grossTotalsCents.map((_, index) => {
    const share = shares[index]!;
    return share.baseCents;
  });
  const allocatedCents = discountCentsByItem.reduce((sum, cents) => sum + cents, 0);

  // Invariant: everything allocated, nothing more, no item over its gross.
  if (allocatedCents !== discountCents) return { ok: false, error: 'invalid_discount' };
  if (discountCentsByItem.some((cents, index) => cents > grossTotalsCents[index]!)) {
    return { ok: false, error: 'discount_exceeds_subtotal' };
  }

  return { ok: true, discountCentsByItem, allocatedCents };
}

export interface ApplyBasketDiscountOutcome {
  /** The plan with net item amounts (input plan when nothing was applied). */
  plan: ReceiptPlan;
  /** True when at least one basket discount was folded into the items. */
  applied: boolean;
  /** Total discount folded into the items (0 when not applied). */
  appliedDiscountCents: number;
}

/** Tolerance for the OCR's printed-total check (rounding noise on the photo). */
const EQUATION_TOLERANCE_CENTS = 2;

function isBasketDiscount(adjustment: ReceiptAdjustment): boolean {
  return adjustment.kind === 'discount' && adjustment.amountCents < 0 && adjustment.scope !== 'item';
}

function isItemDiscount(adjustment: ReceiptAdjustment): boolean {
  return (
    adjustment.kind === 'discount' &&
    adjustment.amountCents < 0 &&
    adjustment.scope === 'item' &&
    adjustment.itemIndex !== null &&
    adjustment.itemIndex !== undefined
  );
}

/**
 * Fold the OCR-classified discounts into the plan's item amounts:
 *
 *  - item-scoped discounts reduce ONLY their line;
 *  - basket-scoped discounts are spread proportionally over ALL items
 *    (Largest Remainder), but ONLY when the money equation closes against the
 *    printed total: items subtotal − discounts ≈ total paid (±2¢). When the
 *    receipt prints no total, the discounts are trusted as classified (their
 *    magnitudes are printed on the note). When the equation does NOT close
 *    (e.g. the model read the pre-discount subtotal as "total"), nothing is
 *    touched — the existing reconciliation hint keeps flagging the difference.
 *
 * Applied items keep an audit trail (`grossAmountCents`, `basketDiscountCents`)
 * and the consumed adjustments are REMOVED from the plan so downstream flows
 * (live split hand-off) never rate the same discount twice. Pure.
 */
export function applyBasketDiscountToReceiptPlan(plan: ReceiptPlan): ApplyBasketDiscountOutcome {
  const unchanged: ApplyBasketDiscountOutcome = { plan, applied: false, appliedDiscountCents: 0 };
  if (plan.items.length === 0) return unchanged;

  const itemDiscounts = plan.adjustments.filter(isItemDiscount);
  const basketDiscounts = plan.adjustments.filter(isBasketDiscount);
  if (itemDiscounts.length === 0 && basketDiscounts.length === 0) return unchanged;

  const grossTotals = plan.items.map((item) => item.amountCents);
  const subtotalCents = grossTotals.reduce((sum, cents) => sum + cents, 0);
  const totalDiscountCents = [...itemDiscounts, ...basketDiscounts].reduce(
    (sum, adjustment) => sum + Math.abs(adjustment.amountCents),
    0,
  );

  if (totalDiscountCents <= 0 || totalDiscountCents > subtotalCents) return unchanged;

  // Money equation check (only possible when the note prints its paid total).
  if (plan.readTotalCents !== null) {
    const expectedPaid = subtotalCents - totalDiscountCents;
    if (Math.abs(expectedPaid - plan.readTotalCents) > EQUATION_TOLERANCE_CENTS) return unchanged;
  }

  // Start from the gross lines; apply item-scoped discounts first.
  const workingCents = [...grossTotals];
  const discountByItem = plan.items.map(() => 0);
  for (const adjustment of itemDiscounts) {
    const index = adjustment.itemIndex!;
    if (index < 0 || index >= workingCents.length) return unchanged;
    const magnitude = Math.abs(adjustment.amountCents);
    if (magnitude > workingCents[index]!) return unchanged;
    workingCents[index]! -= magnitude;
    discountByItem[index]! += magnitude;
  }

  // Then spread each basket discount over the REMAINING (net-so-far) values, so
  // stacked discounts compose the way the cashier applied them.
  for (const adjustment of basketDiscounts) {
    const magnitude = Math.abs(adjustment.amountCents);
    const result = allocateBasketDiscount(workingCents, magnitude, null);
    if (!result.ok) return unchanged;
    result.discountCentsByItem.forEach((cents, index) => {
      workingCents[index]! -= cents;
      discountByItem[index]! += cents;
    });
  }

  const items: ReceiptDraftItem[] = plan.items.map((item, index) => {
    const discount = discountByItem[index]!;
    if (discount <= 0) return item;
    return {
      ...item,
      amountCents: workingCents[index]!,
      grossAmountCents: item.amountCents,
      basketDiscountCents: discount,
    };
  });

  // The folded discounts leave the plan; couvert/other (and any discount we did
  // not consume — impossible here, all-or-nothing) stay for downstream flows.
  const adjustments = plan.adjustments.filter(
    (adjustment) => !isBasketDiscount(adjustment) && !isItemDiscount(adjustment),
  );

  return {
    plan: { ...plan, items, adjustments },
    applied: true,
    appliedDiscountCents: totalDiscountCents,
  };
}
