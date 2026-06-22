import { z } from 'zod';

/**
 * AI Quick Entry (DEC-246) — the AI is a PLANNER, the device is the EXECUTOR.
 *
 * The cloud model reads the user's free text and returns ONE typed `AiIntent`:
 * an action + entities referenced BY NAME/LABEL (never ids, never math). The
 * device then resolves names → ids locally (`resolve.ts`), plans the concrete
 * operation (`plan.ts`) and runs it through the EXISTING orchestrators
 * (`dispatch.ts`). The model output is treated as UNTRUSTED — every field is
 * coerced/validated here so a malformed response degrades to `unknown` instead
 * of crashing.
 */

/** Every action the router can choose. Execute-actions write data through the
 *  domain engines; open-actions navigate to an existing flow. */
export const AI_ACTIONS = [
  // — execute (mirror QuickAdd / the money engines) —
  'log_expense', // I spent X (mine, not shared)
  'someone_paid', // {person} paid for me → I OWE them (DEC-114 row 4)
  'i_paid_for', // I paid for {person} → they owe me the full amount
  'split_expense', // I paid X, split equally among participants
  'record_income', // I received X (reimbursement, top-up)
  'transfer', // move money between my wallets
  'withdraw', // cash withdrawal (bank → cash wallet)
  'settle_debt', // record a settlement with {person}
  'plan_purchase', // earmark a future purchase
  // — open (navigate to an existing screen/flow) —
  'open_split_bill', // the full itemized bill-split flow
  'open_scan_receipt', // the receipt scanner
  'open_outing', // start an outing/bar session
  'open_plan_expense', // the "planejar um gasto" door
  'open_simulator', // the purchase simulator
  'open_screen', // jump to a named screen (debts, wallets, …)
  // — inform (answer in place; no write, no navigation) —
  'convert_currency', // FB-04: "quanto é 20 euros em reais?" → compute & show
  'compare_unit_price', // DEC-283: "o que vale mais, 120g por 1€ ou 200g por 2€?"
  // — fallback —
  'unknown',
] as const;

export type AiAction = (typeof AI_ACTIONS)[number];

export const AI_SCREENS = [
  'debts',
  'expenses',
  'dashboard',
  'wallets',
  'planner',
  'income',
  'trip',
] as const;

export type AiScreen = (typeof AI_SCREENS)[number];

export type AiPayer = 'me' | 'other';
export type AiDirection = 'i_owe' | 'owes_me';

/** DEC-283: one product line in a cost-benefit comparison ("120 g por 1€"). The
 *  device resolves the unit and does the pure math (`domain/shopping`); the model
 *  only extracts what was said, never the verdict. */
export interface AiComparisonItem {
  /** Price in major units (e.g. 2 for "2 euros"). */
  price: number | null;
  /** Quantity as stated (e.g. 200 for "200 g"). */
  quantity: number | null;
  /** Raw unit token ("g", "ml", "un", "kg"…) — the device resolves it. */
  unit: string | null;
  /** Optional product label ("chocolate A"). */
  label: string | null;
}

/** The normalized, typed intent the device works with. Entities are by name. */
export interface AiIntent {
  action: AiAction;
  /** Amount in major units (e.g. 2 for "2 euros"); null when not stated. */
  amount: number | null;
  /** ISO 4217 code the user mentioned, else null (device defaults to base). */
  currency: string | null;
  /** FB-04: the target currency for a `convert_currency` ask ("…em reais" →
   *  BRL). For money events it stays null. */
  toCurrency: string | null;
  description: string | null;
  /** Free category label ("cerveja", "uber") — resolver snaps to a taxonomy. */
  category: string | null;
  /** Primary counterpart name ("Bruno"). */
  person: string | null;
  /** Everyone named for a split (may include the counterpart). */
  participants: string[];
  payer: AiPayer | null;
  direction: AiDirection | null;
  fromWallet: string | null;
  toWallet: string | null;
  place: string | null;
  /** Natural ("ontem") or ISO date; resolver normalizes. */
  date: string | null;
  /** Name of a planned purchase ("tênis"). */
  itemName: string | null;
  /** DEC-283: the products to compare for a `compare_unit_price` ask. Empty for
   *  every other action. */
  comparisonItems: AiComparisonItem[];
  screen: AiScreen | null;
  /** A short model note shown when it needs to ask something. */
  note: string | null;
  /** Self-reported 0..1 confidence; null when absent. */
  confidence: number | null;
}

export type AssistantParseResult =
  | { ok: true; intent: AiIntent }
  | { ok: false; error: 'invalid' };

export type AssistantListParseResult =
  | { ok: true; intents: AiIntent[] }
  | { ok: false; error: 'invalid' };

/* ── coercion helpers — the model is untrusted, so be liberal on input ─────── */

const CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  '$': 'USD',
  'US$': 'USD',
  'R$': 'BRL',
  '£': 'GBP',
  '¥': 'JPY',
};

/**
 * Parses a numeric amount the model may return as a string in mixed locales.
 * Handles a comma decimal ("12,80" → 12.8), a dot/space thousands separator with
 * a comma decimal ("1.250,00" → 1250), and the en form ("1,250.00" → 1250). When
 * only one separator is present, the LAST one is treated as the decimal point.
 */
function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  let s = value.replace(/[^0-9.,]/g, '');
  if (s === '') return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the right-most separator is the decimal point; strip the other.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // Only commas (pt-BR/EU): the last comma is the decimal point; strip any
    // earlier commas as thousands separators ("12,80" → 12.8).
    s = s.slice(0, lastComma).replace(/,/g, '') + '.' + s.slice(lastComma + 1);
  }
  // Only dots (or none) pass through unchanged ("12.80", "1250").

  if (s === '' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function coerceCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (raw === '') return null;
  if (CURRENCY_SYMBOLS[raw]) return CURRENCY_SYMBOLS[raw]!;
  const upper = raw.toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : null;
}

function coerceEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T | null): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function coerceParticipants(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry !== '');
  }
  const single = coerceString(value);
  return single ? [single] : [];
}

function coerceConfidence(value: unknown): number | null {
  const n = coerceNumber(value);
  if (n === null) return null;
  return Math.min(1, Math.max(0, n));
}

/** DEC-283: coerces the model's comparison list (untrusted). Keeps only lines
 *  with both a price AND a quantity (a unit is optional — the user picks it in
 *  the UI when omitted); accepts a few aliases the model tends to use. */
function coerceComparisonItems(value: unknown): AiComparisonItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): AiComparisonItem | null => {
      if (!entry || typeof entry !== 'object') return null;
      const obj = entry as Record<string, unknown>;
      const price = coerceNumber(obj.price ?? obj.amount ?? obj.cost);
      const quantity = coerceNumber(obj.quantity ?? obj.qty ?? obj.weight ?? obj.size);
      if (price === null || quantity === null) return null;
      return {
        price,
        quantity,
        unit: coerceString(obj.unit ?? obj.measure),
        label: coerceString(obj.label ?? obj.name ?? obj.product),
      };
    })
    .filter((item): item is AiComparisonItem => item !== null)
    .slice(0, 6);
}

const numberField = z.unknown().transform(coerceNumber);
const stringField = z.unknown().transform(coerceString);
const currencyField = z.unknown().transform(coerceCurrency);
const participantsField = z.unknown().transform(coerceParticipants);
const confidenceField = z.unknown().transform(coerceConfidence);
const comparisonItemsField = z.unknown().transform(coerceComparisonItems);
const payerField = z.unknown().transform((v) => coerceEnum<AiPayer>(v, ['me', 'other'], null));
const directionField = z.unknown().transform((v) => coerceEnum<AiDirection>(v, ['i_owe', 'owes_me'], null));
const screenField = z.unknown().transform((v) => coerceEnum<AiScreen>(v, AI_SCREENS, null));
const actionField = z.unknown().transform((v) => coerceEnum<AiAction>(v, AI_ACTIONS, 'unknown') ?? 'unknown');

const intentSchema = z.object({
  action: actionField,
  amount: numberField.optional(),
  currency: currencyField.optional(),
  toCurrency: currencyField.optional(),
  description: stringField.optional(),
  category: stringField.optional(),
  person: stringField.optional(),
  participants: participantsField.optional(),
  payer: payerField.optional(),
  direction: directionField.optional(),
  fromWallet: stringField.optional(),
  toWallet: stringField.optional(),
  place: stringField.optional(),
  date: stringField.optional(),
  itemName: stringField.optional(),
  comparisonItems: comparisonItemsField.optional(),
  screen: screenField.optional(),
  note: stringField.optional(),
  confidence: confidenceField.optional(),
});

/** Coerces ONE already-unwrapped candidate object into a safe `AiIntent`, or
 *  null when it isn't an object (the schema itself never fails — every field is a
 *  liberal transform, so a junk value degrades to a null/`unknown` field). */
function coerceIntent(candidate: unknown): AiIntent | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const parsed = intentSchema.safeParse(candidate);
  if (!parsed.success) return null;
  const data = parsed.data;
  return {
    action: data.action,
    amount: data.amount ?? null,
    currency: data.currency ?? null,
    toCurrency: data.toCurrency ?? null,
    description: data.description ?? null,
    category: data.category ?? null,
    person: data.person ?? null,
    participants: data.participants ?? [],
    payer: data.payer ?? null,
    direction: data.direction ?? null,
    fromWallet: data.fromWallet ?? null,
    toWallet: data.toWallet ?? null,
    place: data.place ?? null,
    date: data.date ?? null,
    itemName: data.itemName ?? null,
    comparisonItems: data.comparisonItems ?? [],
    screen: data.screen ?? null,
    note: data.note ?? null,
    confidence: data.confidence ?? null,
  };
}

/**
 * Normalizes any model response shape into a flat list of candidate objects.
 * Accepts a JSON string, a bare object, a bare array, or a wrapper — the
 * multi-action contract `{ actions: [...] }` (DEC-246 multi), plus the legacy
 * `{ intent: {...} }` and `{ intents: [...] }` shapes. Never throws.
 */
function extractCandidates(raw: unknown): unknown[] {
  let candidate: unknown = raw;

  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return [];
    }
  }

  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const obj = candidate as Record<string, unknown>;
    if (Array.isArray(obj.actions)) candidate = obj.actions;
    else if (Array.isArray(obj.intents)) candidate = obj.intents;
    else if (obj.intent && typeof obj.intent === 'object') candidate = [obj.intent];
  }

  return Array.isArray(candidate) ? candidate : [candidate];
}

/**
 * Parses a model response into a LIST of safe `AiIntent`s — the multi-action
 * contract (one element per money event). A single-event message yields a
 * one-element list. An unrecognised/empty shape returns `{ ok: false }`.
 */
export function parseAssistantIntents(raw: unknown): AssistantListParseResult {
  const intents = extractCandidates(raw)
    .map(coerceIntent)
    .filter((intent): intent is AiIntent => intent !== null);
  if (intents.length === 0) return { ok: false, error: 'invalid' };
  return { ok: true, intents };
}

/**
 * Parses a model response into a single safe `AiIntent` (the FIRST event).
 * Back-compat for the single-intent callers/tests; built on the same liberal,
 * never-throws coercion as `parseAssistantIntents`.
 */
export function parseAssistantResponse(raw: unknown): AssistantParseResult {
  const result = parseAssistantIntents(raw);
  if (!result.ok) return { ok: false, error: 'invalid' };
  return { ok: true, intent: result.intents[0]! };
}

const EXECUTE_ACTIONS: ReadonlySet<AiAction> = new Set<AiAction>([
  'log_expense',
  'someone_paid',
  'i_paid_for',
  'split_expense',
  'record_income',
  'transfer',
  'withdraw',
  'settle_debt',
  'plan_purchase',
]);

/** True when the action writes data (vs. merely navigating to a screen). */
export function isExecuteAction(action: AiAction): boolean {
  return EXECUTE_ACTIONS.has(action);
}
