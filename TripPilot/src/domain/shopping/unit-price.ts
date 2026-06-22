/**
 * Cost-benefit comparator (DEC-283) — the PURE, currency-agnostic engine that
 * answers "which package is the better buy per unit?". It is the twin of the
 * currency converter (DEC-256): a tiny deterministic read with no i/o, no AI and
 * no token cost, so it works fully offline. The UI (`features/comparator`) and
 * the AI intent (`compare_unit_price`) both feed it `{ priceCents, quantity,
 * unit }` items and render its verdict.
 *
 * Honesty (Critic, DEC-283): scope is STRICTLY price-per-unit-of-measure. It
 * never judges quality/%, and never invents a price — every number comes from
 * what the user typed/read off the shelf. Items of DIFFERENT dimensions (weight
 * vs volume vs count) are NOT comparable, so the engine flags that instead of
 * declaring a bogus winner.
 *
 * Math: quantities normalize to a dimension base unit (g / ml / unit). The price
 * per base unit (`perBaseCents = priceCents / baseQuantity`) is what ranks the
 * items; a display unit (kg / L / unit) yields the friendly "€X/kg" figure.
 */

export type UnitDimension = 'weight' | 'volume' | 'count';

interface UnitDefinition {
  code: string;
  dimension: UnitDimension;
  /** How many dimension-base units (g / ml / unit) make up 1 of this unit. */
  perBase: number;
  /** Accent-insensitive synonyms a user (or the AI) might type, in pt/en/es. */
  aliases: string[];
}

/**
 * Data-driven unit table (no hard-coded conditionals). Base unit per dimension:
 * weight = gram, volume = millilitre, count = unit.
 */
const UNIT_DEFINITIONS: readonly UnitDefinition[] = [
  { code: 'mg', dimension: 'weight', perBase: 0.001, aliases: ['mg', 'miligrama', 'miligramas', 'milligram', 'milligrams'] },
  { code: 'g', dimension: 'weight', perBase: 1, aliases: ['g', 'gr', 'grama', 'gramas', 'gram', 'grams', 'gramo', 'gramos'] },
  { code: 'kg', dimension: 'weight', perBase: 1000, aliases: ['kg', 'kgs', 'quilo', 'quilos', 'kilo', 'kilos', 'quilograma', 'kilogram', 'kilogramo'] },
  { code: 'ml', dimension: 'volume', perBase: 1, aliases: ['ml', 'mls', 'mililitro', 'mililitros', 'millilitre', 'milliliter', 'mililitro'] },
  { code: 'cl', dimension: 'volume', perBase: 10, aliases: ['cl', 'centilitro', 'centilitros'] },
  { code: 'l', dimension: 'volume', perBase: 1000, aliases: ['l', 'lt', 'lts', 'litro', 'litros', 'liter', 'litre', 'liters', 'litres'] },
  { code: 'un', dimension: 'count', perBase: 1, aliases: ['un', 'und', 'unid', 'unidade', 'unidades', 'unit', 'units', 'u', 'pc', 'pcs', 'peca', 'pecas', 'count', 'cada', 'item', 'itens'] },
];

/** The units the picker offers (one canonical per common need). */
export const COMPARATOR_UNITS: readonly string[] = ['g', 'kg', 'ml', 'l', 'un'];

/** The friendly unit a per-unit price is expressed in, per dimension. */
const DISPLAY_UNIT: Record<UnitDimension, { code: string; perBase: number }> = {
  weight: { code: 'kg', perBase: 1000 },
  volume: { code: 'l', perBase: 1000 },
  count: { code: 'un', perBase: 1 },
};

/** Two unit prices within this fraction of each other read as a "tie". */
const TIE_FRACTION = 0.03;

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Resolves a raw unit token (any language, accents, plural, trailing dot) to a
 *  canonical definition, or null when unrecognised. */
export function resolveUnit(raw: string | null | undefined): UnitDefinition | null {
  if (typeof raw !== 'string') return null;
  const key = stripAccents(raw.trim().toLowerCase()).replace(/\.$/, '');
  if (key === '') return null;
  for (const def of UNIT_DEFINITIONS) {
    if (def.aliases.includes(key)) return def;
  }
  return null;
}

export interface NormalizedQuantity {
  /** Quantity expressed in the dimension's base unit (g / ml / unit). */
  baseValue: number;
  dimension: UnitDimension;
}

/** Converts a `(value, unit)` pair into the dimension base unit. Returns null
 *  when the unit is unknown or the value is non-finite / non-positive. */
export function normalizeQuantity(value: number, unit: string | null | undefined): NormalizedQuantity | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const def = resolveUnit(unit);
  if (!def) return null;
  return { baseValue: value * def.perBase, dimension: def.dimension };
}

export interface UnitPriceItemInput {
  id: string;
  label?: string;
  /** Price in minor units (cents) of whatever single currency the items share. */
  priceCents: number;
  quantity: number;
  unit: string;
}

export interface UnitPriceEntry {
  id: string;
  label?: string;
  dimension: UnitDimension | null;
  /** Price per dimension base unit (g / ml / unit) — the ranking figure. */
  perBaseCents: number | null;
  /** Price per friendly display unit (kg / L / unit) — for the "€X/kg" line. */
  perDisplayUnitCents: number | null;
  /** 'kg' | 'l' | 'un' — the unit `perDisplayUnitCents` is expressed in. */
  displayUnit: string | null;
  /** True when price + quantity + unit all parsed into a comparable figure. */
  valid: boolean;
}

export interface UnitPriceComparison {
  entries: UnitPriceEntry[];
  /** Cheapest per-unit item; null when fewer than 2 comparable items, or mixed. */
  bestId: string | null;
  /** Most expensive per-unit item among the comparable set. */
  worstId: string | null;
  /** How much cheaper the best is vs the worst, in percent (0..100); null when
   *  not computable. */
  savingsPct: number | null;
  /** The top two comparable items are within `TIE_FRACTION` → effectively equal. */
  tie: boolean;
  /** Valid items span more than one dimension → not comparable by unit price. */
  mixedDimensions: boolean;
  /** How many items produced a comparable per-unit figure. */
  comparableCount: number;
}

function toEntry(item: UnitPriceItemInput): UnitPriceEntry {
  const base = { id: item.id, label: item.label };
  const normalized = normalizeQuantity(item.quantity, item.unit);
  if (!normalized || !Number.isFinite(item.priceCents) || item.priceCents < 0) {
    return { ...base, dimension: normalized?.dimension ?? null, perBaseCents: null, perDisplayUnitCents: null, displayUnit: null, valid: false };
  }
  const perBaseCents = item.priceCents / normalized.baseValue;
  const display = DISPLAY_UNIT[normalized.dimension];
  return {
    ...base,
    dimension: normalized.dimension,
    perBaseCents,
    perDisplayUnitCents: perBaseCents * display.perBase,
    displayUnit: display.code,
    valid: true,
  };
}

/**
 * Compares N items by price-per-unit. Pure and deterministic: it ranks only the
 * VALID, same-dimension items, flags a mix of dimensions (not comparable), and
 * reports the saving of the best over the worst. With fewer than two comparable
 * items there is no winner (each item still shows its own per-unit price).
 */
export function compareUnitPrice(items: UnitPriceItemInput[]): UnitPriceComparison {
  const entries = items.map(toEntry);
  const valid = entries.filter((e) => e.valid && e.perBaseCents !== null);

  const dimensions = new Set(valid.map((e) => e.dimension));
  const mixedDimensions = dimensions.size > 1;
  const comparableCount = valid.length;

  if (mixedDimensions || comparableCount < 2) {
    return { entries, bestId: null, worstId: null, savingsPct: null, tie: false, mixedDimensions, comparableCount };
  }

  const sorted = [...valid].sort((a, b) => a.perBaseCents! - b.perBaseCents!);
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;
  const second = sorted[1]!;

  const savingsPct = worst.perBaseCents! > 0 ? ((worst.perBaseCents! - best.perBaseCents!) / worst.perBaseCents!) * 100 : null;
  const tie = second.perBaseCents! > 0 && (second.perBaseCents! - best.perBaseCents!) / second.perBaseCents! < TIE_FRACTION;

  return { entries, bestId: best.id, worstId: worst.id, savingsPct, tie, mixedDimensions: false, comparableCount };
}
