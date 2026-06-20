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

/** The normalized, typed intent the device works with. Entities are by name. */
export interface AiIntent {
  action: AiAction;
  /** Amount in major units (e.g. 2 for "2 euros"); null when not stated. */
  amount: number | null;
  /** ISO 4217 code the user mentioned, else null (device defaults to base). */
  currency: string | null;
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
  screen: AiScreen | null;
  /** A short model note shown when it needs to ask something. */
  note: string | null;
  /** Self-reported 0..1 confidence; null when absent. */
  confidence: number | null;
}

export type AssistantParseResult =
  | { ok: true; intent: AiIntent }
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

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

const numberField = z.unknown().transform(coerceNumber);
const stringField = z.unknown().transform(coerceString);
const currencyField = z.unknown().transform(coerceCurrency);
const participantsField = z.unknown().transform(coerceParticipants);
const confidenceField = z.unknown().transform(coerceConfidence);
const payerField = z.unknown().transform((v) => coerceEnum<AiPayer>(v, ['me', 'other'], null));
const directionField = z.unknown().transform((v) => coerceEnum<AiDirection>(v, ['i_owe', 'owes_me'], null));
const screenField = z.unknown().transform((v) => coerceEnum<AiScreen>(v, AI_SCREENS, null));
const actionField = z.unknown().transform((v) => coerceEnum<AiAction>(v, AI_ACTIONS, 'unknown') ?? 'unknown');

const intentSchema = z.object({
  action: actionField,
  amount: numberField.optional(),
  currency: currencyField.optional(),
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
  screen: screenField.optional(),
  note: stringField.optional(),
  confidence: confidenceField.optional(),
});

/**
 * Parses a model response into a safe `AiIntent`. Accepts a JSON string, a plain
 * object, or a `{ intent: {...} }` / single-element-array wrapper (defensive).
 * Never throws — an unrecognised shape returns `{ ok: false }`.
 */
export function parseAssistantResponse(raw: unknown): AssistantParseResult {
  let candidate: unknown = raw;

  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return { ok: false, error: 'invalid' };
    }
  }

  if (Array.isArray(candidate)) candidate = candidate[0];

  if (candidate && typeof candidate === 'object') {
    const obj = candidate as Record<string, unknown>;
    if (obj.intent && typeof obj.intent === 'object') candidate = obj.intent;
  }

  if (!candidate || typeof candidate !== 'object') return { ok: false, error: 'invalid' };

  const parsed = intentSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const data = parsed.data;
  const intent: AiIntent = {
    action: data.action,
    amount: data.amount ?? null,
    currency: data.currency ?? null,
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
    screen: data.screen ?? null,
    note: data.note ?? null,
    confidence: data.confidence ?? null,
  };

  return { ok: true, intent };
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
