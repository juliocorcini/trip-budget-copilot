import { v4 as uuidv4 } from 'uuid';
import { toCents } from '@/domain/money';
import { guessCategory, extractCity } from '@/domain/import/wise-import';
import type {
  ReceiptAdjustment,
  ReceiptDraftItem,
  ReceiptPlan,
  ReceiptReconciliation,
  ReceiptServiceCharge,
} from './types';

const ADJUSTMENT_KINDS: ReceiptAdjustment['kind'][] = ['couvert', 'discount', 'other'];

const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

/**
 * Coerce an OCR numeric field into a finite number. The prompt asks for plain
 * dot-decimals, but vision models occasionally emit currency symbols, spaces or
 * a comma decimal — strip those defensively. Returns null when not a number.
 */
function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let cleaned = value.replace(/[^\d.,-]/g, '').trim();
  if (cleaned === '') return null;
  // No dot but a comma → comma is the decimal separator (e.g. "3,50").
  if (!cleaned.includes('.') && cleaned.includes(',')) cleaned = cleaned.replace(',', '.');
  else cleaned = cleaned.replace(/,/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function coerceCurrency(value: unknown): string | null {
  const code = coerceString(value);
  if (code === null) return null;
  const upper = code.toUpperCase();
  return CURRENCY_CODE_RE.test(upper) ? upper : null;
}

/** A positive quantity defaulting to 1; receipts rarely print fractional counts. */
function coerceQty(value: unknown): number {
  const qty = coerceNumber(value);
  if (qty === null || qty <= 0) return 1;
  return qty;
}

/**
 * Resolve a single line's cents amount: prefer the printed line total, fall back
 * to unitPrice * qty. Returns null when neither yields a positive amount, so the
 * line is dropped instead of creating a €0 expense.
 */
function resolveAmountCents(rawItem: Record<string, unknown>, qty: number): number | null {
  const lineTotal = coerceNumber(rawItem.lineTotal ?? rawItem.total);
  if (lineTotal !== null && lineTotal > 0) return toCents(lineTotal);
  const unitPrice = coerceNumber(rawItem.unitPrice ?? rawItem.price);
  if (unitPrice !== null && unitPrice > 0) return toCents(unitPrice * qty);
  return null;
}

function buildDraftItem(rawItem: Record<string, unknown>, merchant: string | null): ReceiptDraftItem | null {
  const qty = coerceQty(rawItem.qty ?? rawItem.quantity);
  const amountCents = resolveAmountCents(rawItem, qty);
  if (amountCents === null || amountCents <= 0) return null;
  const description = coerceString(rawItem.description ?? rawItem.name) ?? 'Item';
  return {
    id: uuidv4(),
    description,
    qty,
    amountCents,
    category: guessCategory(merchant, description),
    include: true,
    participantIds: [],
    paidByParticipantId: null,
  };
}

/** A clean boolean, or null for anything ambiguous (the split layer then asks). */
function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === 'yes' || v === 'sim') return true;
    if (v === 'false' || v === 'no' || v === 'nao' || v === 'não') return false;
  }
  return null;
}

/** An OCR adjustment kind, defaulting unknown values to the neutral 'other'. */
function coerceAdjustmentKind(value: unknown): ReceiptAdjustment['kind'] {
  const code = coerceString(value)?.toLowerCase();
  return ADJUSTMENT_KINDS.find((kind) => kind === code) ?? 'other';
}

/**
 * T3 — normalise the OCR's service-charge read. An absolute amount is taken to
 * cents (non-positive → null); a percentage is kept as a rate; `included` stays
 * null unless the model was unambiguous. The split layer (`detectServiceCharge`)
 * turns this raw read into a mode/source and decides whether to still ask.
 */
function parseServiceCharge(value: unknown): ReceiptServiceCharge {
  if (typeof value !== 'object' || value === null) {
    return { amountCents: null, percent: null, included: null };
  }
  const raw = value as Record<string, unknown>;
  const amount = coerceNumber(raw.amount);
  const percent = coerceNumber(raw.percent);
  return {
    amountCents: amount !== null && amount > 0 ? toCents(amount) : null,
    percent: percent !== null && percent > 0 ? percent : null,
    included: coerceBoolean(raw.included),
  };
}

/**
 * E6 — normalise the OCR's non-product money lines. Zero/blank lines are dropped;
 * a discount is forced negative (a credit) regardless of how the model signed it,
 * so the downstream proportional rate-out always treats it as money back.
 */
function parseAdjustments(value: unknown): ReceiptAdjustment[] {
  if (!Array.isArray(value)) return [];
  const result: ReceiptAdjustment[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const raw = entry as Record<string, unknown>;
    const amount = coerceNumber(raw.amount);
    if (amount === null || amount === 0) continue;
    const kind = coerceAdjustmentKind(raw.kind);
    const magnitudeCents = toCents(Math.abs(amount));
    const amountCents = kind === 'discount' ? -magnitudeCents : toCents(amount);
    result.push({ kind, label: coerceString(raw.label) ?? kind, amountCents });
  }
  return result;
}

/**
 * DEC-206 (G2): normalise a raw OCR response (cloud or device) into a cents-based
 * `ReceiptPlan`. Pure and defensive — any malformed field is coerced or the line
 * is skipped, so a noisy model response never throws. Accepts either the full
 * object shape or a bare items array.
 */
export function parseReceiptResponse(raw: unknown): ReceiptPlan {
  const root: Record<string, unknown> = Array.isArray(raw)
    ? { items: raw }
    : typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const merchant = coerceString(root.merchant);
  const rawItems = Array.isArray(root.items) ? root.items : [];

  const items: ReceiptDraftItem[] = [];
  for (const entry of rawItems) {
    if (typeof entry !== 'object' || entry === null) continue;
    const draft = buildDraftItem(entry as Record<string, unknown>, merchant);
    if (draft !== null) items.push(draft);
  }

  const readTotal = coerceNumber(root.total);
  return {
    merchant,
    placeLabel: extractCity(merchant),
    currency: coerceCurrency(root.currency),
    readTotalCents: readTotal !== null && readTotal > 0 ? toCents(readTotal) : null,
    items,
    serviceCharge: parseServiceCharge(root.serviceCharge),
    adjustments: parseAdjustments(root.adjustments),
  };
}

/**
 * D-IMP-05: pick the category that dominates a receipt's INCLUDED lines by spend,
 * so a receipt the vision model could read items from but NOT a merchant name can
 * still be titled after what it mostly is ("Mercado", "Restaurante") instead of a
 * generic "Nota". The uninformative `other` bucket never wins — a note named
 * "Outros" is no better than "Nota" — so it is ignored unless it is the only
 * thing present (in which case we still return null and let the caller fall back).
 * Ties break toward the larger line count, then first appearance. Pure.
 */
export function dominantReceiptCategory(items: ReceiptDraftItem[]): string | null {
  const tally = new Map<string, { cents: number; count: number; order: number }>();
  let order = 0;
  for (const item of items) {
    if (!item.include || item.amountCents <= 0) continue;
    if (item.category === 'other') continue;
    const current = tally.get(item.category);
    if (current === undefined) {
      tally.set(item.category, { cents: item.amountCents, count: 1, order: order++ });
    } else {
      current.cents += item.amountCents;
      current.count += 1;
    }
  }

  let best: string | null = null;
  let bestStats: { cents: number; count: number; order: number } | null = null;
  for (const [category, stats] of tally) {
    if (
      bestStats === null ||
      stats.cents > bestStats.cents ||
      (stats.cents === bestStats.cents && stats.count > bestStats.count) ||
      (stats.cents === bestStats.cents && stats.count === bestStats.count && stats.order < bestStats.order)
    ) {
      best = category;
      bestStats = stats;
    }
  }
  return best;
}

/**
 * G4 (DEC-206): proportionally adjust the INCLUDED items so they sum exactly to
 * the printed receipt total — absorbing the tax, tip, service charge, discount
 * and rounding that the itemised lines don't capture. Each included line is
 * scaled by its weight in the current included subtotal and the last one absorbs
 * the rounding remainder, so the sum is exact to the cent. Excluded lines and the
 * original order are preserved. No-op when there is no printed total or nothing
 * positive to scale (returns the same array reference so callers can skip a render).
 */
export function matchItemsToReadTotal(plan: ReceiptPlan): ReceiptDraftItem[] {
  const target = plan.readTotalCents;
  if (target === null || target <= 0) return plan.items;

  const included = plan.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.include && item.amountCents > 0);
  const subtotal = included.reduce((sum, { item }) => sum + item.amountCents, 0);
  if (subtotal <= 0 || subtotal === target) return plan.items;

  const next = plan.items.slice();
  let allocated = 0;
  included.forEach(({ item, index }, i) => {
    const isLast = i === included.length - 1;
    const amountCents = isLast ? target - allocated : Math.round((item.amountCents / subtotal) * target);
    allocated += amountCents;
    next[index] = { ...item, amountCents };
  });
  return next;
}

/**
 * F7 (outing scan) — reduce a parsed receipt to a SINGLE "add it as one expense"
 * line for the active outing: the amount is the printed total when present, else
 * the sum of the kept positive items; the title is the merchant as printed (the
 * caller falls back to the dominant category or the session name when null).
 * Returns null when there is nothing positive to add (an unreadable note), so the
 * caller can show "couldn't read it" instead of adding a €0 item. Pure.
 */
export function summarizeReceiptTotal(plan: ReceiptPlan): { amountCents: number; merchant: string | null } | null {
  const itemsTotalCents = plan.items
    .filter((item) => item.include && item.amountCents > 0)
    .reduce((sum, item) => sum + item.amountCents, 0);
  const amountCents =
    plan.readTotalCents !== null && plan.readTotalCents > 0 ? plan.readTotalCents : itemsTotalCents;
  if (amountCents <= 0) return null;
  const merchant = plan.merchant?.trim() ?? '';
  return { amountCents, merchant: merchant.length > 0 ? merchant : null };
}

/**
 * Compare the kept items against the printed total. Purely informational: the
 * difference is usually tax/discount lines we intentionally drop, so the UI
 * shows it as a hint rather than blocking the commit.
 */
export function reconcileReceipt(plan: ReceiptPlan, toleranceCents = 0): ReceiptReconciliation {
  const itemsTotalCents = plan.items
    .filter((item) => item.include)
    .reduce((sum, item) => sum + item.amountCents, 0);
  const readTotalCents = plan.readTotalCents;
  const diffCents = readTotalCents === null ? null : itemsTotalCents - readTotalCents;
  return {
    itemsTotalCents,
    readTotalCents,
    diffCents,
    matches: diffCents === null ? true : Math.abs(diffCents) <= toleranceCents,
  };
}
