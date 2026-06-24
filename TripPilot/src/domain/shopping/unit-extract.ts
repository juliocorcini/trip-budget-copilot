/**
 * DEC-284: parse ONE product photo extraction (the Worker `/unit-extract` JSON)
 * into a typed item the cost-benefit comparator (DEC-283) can pre-fill. PURE and
 * defensive — the vision model may return partial or garbage fields, so every
 * value is validated, the unit is resolved to the picker's set (the rare mg/cl
 * are converted to g/ml so quantity stays consistent with the shown unit), and
 * anything uncertain is flagged `needsReview` so the user confirms before
 * trusting the number. No i/o here: the transport lives in `utils/ai-unit-extract`.
 */
import { resolveUnit, COMPARATOR_UNITS } from './unit-price';

export interface ExtractedUnitItem {
  /** Package price as read (major units, e.g. 2.49), or null when unreadable. */
  price: number | null;
  /** Net content as read, converted to match `unit` (g/ml/un), or null. */
  quantity: number | null;
  /** Canonical picker unit (g | kg | ml | l | un), or null when unknown. */
  unit: string | null;
  /** Short product name if visible, else null. */
  label: string | null;
  /** ISO 4217 currency code if visible, else null (informational only). */
  currency: string | null;
  /** Model self-reported certainty, clamped to 0..1. */
  confidence: number;
  /** True when the user should double-check this item before trusting it. */
  needsReview: boolean;
}

/** Below this confidence we always ask the user to confirm the read. */
export const UNIT_REVIEW_CONFIDENCE = 0.6;

const LABEL_MAX_LENGTH = 60;

function nonNegativeNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function trimmedStringOrNull(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Trim float noise from a converted quantity (e.g. 500 mg → 0.5 g). */
function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Keep only clean ISO-4217-shaped codes; everything else is dropped to null. */
function currencyOrNull(value: unknown): string | null {
  const raw = trimmedStringOrNull(value, 8);
  if (!raw) return null;
  const code = raw.toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

interface RawUnitExtract {
  price?: unknown;
  quantity?: unknown;
  unit?: unknown;
  label?: unknown;
  currency?: unknown;
  confidence?: unknown;
}

/**
 * Normalize a single raw extraction object into an `ExtractedUnitItem`. Tolerant
 * of nulls, wrong types and out-of-range numbers — never throws.
 */
export function parseUnitExtractResponse(raw: unknown): ExtractedUnitItem {
  const obj: RawUnitExtract = typeof raw === 'object' && raw !== null ? (raw as RawUnitExtract) : {};

  const price = nonNegativeNumberOrNull(obj.price);
  const label = trimmedStringOrNull(obj.label, LABEL_MAX_LENGTH);
  const currency = currencyOrNull(obj.currency);
  const confidence = clampConfidence(obj.confidence);

  let quantity = nonNegativeNumberOrNull(obj.quantity);
  if (quantity !== null && quantity <= 0) quantity = null;

  let unit: string | null = null;
  const def = resolveUnit(typeof obj.unit === 'string' ? obj.unit : null);
  if (def) {
    if (COMPARATOR_UNITS.includes(def.code)) {
      unit = def.code;
    } else {
      // mg / cl are not in the picker — convert the quantity into the dimension's
      // base picker unit (g / ml) so the shown unit and quantity stay consistent.
      unit = def.dimension === 'volume' ? 'ml' : def.dimension === 'weight' ? 'g' : 'un';
      if (quantity !== null) quantity = roundQuantity(quantity * def.perBase);
    }
  }

  const needsReview =
    price === null || quantity === null || unit === null || confidence < UNIT_REVIEW_CONFIDENCE;

  return { price, quantity, unit, label, currency, confidence, needsReview };
}
