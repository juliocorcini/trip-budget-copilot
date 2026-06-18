import {
  createAdjustment,
  createSplitItem,
  createSplitSession,
  detectServiceCharge,
  itemsSubtotalCents,
} from './split';
import type { Adjustment, SplitMode, SplitSession } from './types';
import type { ReceiptPlan } from '@/domain/receipt';

/** Name a merchant-less split when the OCR read no merchant (UI can rename). */
const DEFAULT_SPLIT_NAME = 'Conta';

export interface BuildSplitFromReceiptInput {
  tripId: string | null;
  phaseId: string | null;
  /** The owner's display name in the split (the trip user). */
  ownerName: string;
  /** Trip base currency — used only when the OCR could not read the bill's. */
  fallbackCurrency: string;
  /** The owner's actor id, for live-link propagation (T8); null when offline-only. */
  ownerActorId: string | null;
  /** Optional starting mode; defaults to the session factory's ('itemized'). */
  mode?: SplitMode;
}

export interface ReceiptSplitDraft {
  /** A draft SplitSession seeded with the bill's items, service charge and adjustments. */
  session: SplitSession;
  /**
   * §9.2.3 — true when the service charge could be neither detected nor inferred,
   * so the capture flow must ASK ("does this bill add a service charge?"). The
   * session already carries a `none`/`asked` placeholder until the user answers.
   */
  needsServiceChargePrompt: boolean;
}

/**
 * T3/E6 (M4) — the bridge from an OCR'd {@link ReceiptPlan} to a divisible
 * {@link SplitSession}. It is the "Dividir conta" capture step's pure core: kept
 * positive lines become claimable {@link SplitItem}s, the raw service-charge read
 * is resolved via {@link detectServiceCharge} (detected → inferred-included →
 * ask), and non-product lines become {@link Adjustment}s rated by their default
 * mode (couvert per-head, discount/other proportional — §9.1). No persistence,
 * no transport: the caller commits later via `commitSplit`. Mirrors the receipt
 * parser's defensive contract, so a noisy read still yields a usable draft.
 */
export function buildSplitFromReceipt(plan: ReceiptPlan, input: BuildSplitFromReceiptInput): ReceiptSplitDraft {
  const items = plan.items
    .filter((item) => item.include && item.amountCents > 0)
    .map((item) =>
      createSplitItem({
        description: item.description,
        amountCents: item.amountCents,
        qty: item.qty,
        category: item.category,
      }),
    );

  const base = createSplitSession({
    tripId: input.tripId,
    phaseId: input.phaseId,
    name: plan.merchant ?? DEFAULT_SPLIT_NAME,
    currency: plan.currency ?? input.fallbackCurrency,
    mode: input.mode,
    ownerName: input.ownerName,
    ownerActorId: input.ownerActorId,
    items,
    readTotalCents: plan.readTotalCents,
  });

  const detection = detectServiceCharge({
    detectedAmountCents: plan.serviceCharge.amountCents,
    detectedPercent: plan.serviceCharge.percent,
    included: plan.serviceCharge.included,
    subtotalCents: itemsSubtotalCents(base),
    readTotalCents: plan.readTotalCents,
  });

  const adjustments: Adjustment[] = plan.adjustments.map((adjustment) =>
    createAdjustment({
      kind: adjustment.kind,
      label: adjustment.label,
      amountCents: adjustment.amountCents,
      source: 'detected',
    }),
  );

  return {
    session: { ...base, serviceCharge: detection.serviceCharge, adjustments },
    needsServiceChargePrompt: detection.needsPrompt,
  };
}
