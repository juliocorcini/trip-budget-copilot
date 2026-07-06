import { v4 as uuidv4 } from 'uuid';

/**
 * G4 (DEC-244) — user-defined repayment methods. The owner lists how people can
 * pay them back (a Pix key, a Wise tag, bank details, or any free-text), chooses
 * which to make available, and those lines are appended to the "Lembrar/Cobrar"
 * reminder message. Pure, side-effect-free: persistence lives in AppSettings and
 * the localized labels are injected by the caller (the domain stays i18n-free).
 */

export type PaymentMethodKind = 'pix' | 'wise' | 'bank' | 'other';

export interface PaymentMethod {
  id: string;
  kind: PaymentMethodKind;
  /** Optional user label; when blank the caller's kind label is used. */
  label: string;
  /** The actual key/tag/details people pay to. */
  value: string;
  /** When false the method is kept but excluded from the reminder. */
  enabled: boolean;
  /**
   * DEC-476 — the currencies this method can receive (e.g. a Pix key only takes
   * BRL). Absent or empty = works for EVERY currency (back-compat: methods
   * created before this field behave exactly as before).
   */
  currencies?: string[];
}

/** Display/creation order of the kind chips in the editor. */
export const PAYMENT_METHOD_KINDS: PaymentMethodKind[] = ['pix', 'wise', 'bank', 'other'];

/** Material symbol per kind (UI only; kept here so the set stays in one place). */
export const PAYMENT_METHOD_ICONS: Record<PaymentMethodKind, string> = {
  pix: 'qr_code_2',
  wise: 'swap_horiz',
  bank: 'account_balance',
  other: 'payments',
};

/**
 * FB-27 (DEC-277): how a received reimbursement was paid. A superset of the
 * "how to pay me" kinds (DEC-244) plus `cash` — money handed over in person has
 * no stored instruction, so it lives ONLY here and never enters the payment
 * methods editor. `PAYMENT_METHOD_KINDS`/`PAYMENT_METHOD_ICONS` stay untouched,
 * so DEC-244 (the reminder instructions) is not affected.
 */
export type SettlementMethod = PaymentMethodKind | 'cash';

/** Display order of the method chips in the settle-up sheet. */
export const SETTLEMENT_METHOD_KINDS: SettlementMethod[] = ['pix', 'wise', 'bank', 'cash', 'other'];

/** Material symbol per settlement method (reuses the shared kinds + a cash glyph). */
export const SETTLEMENT_METHOD_ICONS: Record<SettlementMethod, string> = {
  ...PAYMENT_METHOD_ICONS,
  cash: 'payments',
  other: 'more_horiz',
};

export interface PaymentInstructionLabels {
  /** Header line, e.g. "Pode pagar por:". */
  header: string;
  /** Fallback label per kind when the method's own label is blank. */
  kindLabels: Record<PaymentMethodKind, string>;
}

export function createPaymentMethod(
  kind: PaymentMethodKind,
  label: string,
  value: string,
): PaymentMethod {
  return { id: uuidv4(), kind, label: label.trim(), value: value.trim(), enabled: true };
}

/** Enabled methods that actually carry a value (an empty value never shows). */
export function enabledPaymentMethods(methods: PaymentMethod[]): PaymentMethod[] {
  return methods.filter((m) => m.enabled && m.value.trim() !== '');
}

/**
 * DEC-476 — can this method receive the given currency? No scoping (absent or
 * empty `currencies`) means "every currency" so pre-existing methods keep
 * appearing everywhere.
 */
export function paymentMethodAppliesTo(method: PaymentMethod, currency: string): boolean {
  const scoped = method.currencies ?? [];
  return scoped.length === 0 || scoped.includes(currency);
}

/**
 * DEC-476 — the usable (enabled + valued) methods for a charge in the given
 * currencies. An empty `currencies` list means "no filter" (all usable methods),
 * so callers with no currency context keep the old behavior.
 */
export function paymentMethodsForCurrencies(
  methods: PaymentMethod[],
  currencies: string[],
): PaymentMethod[] {
  const usable = enabledPaymentMethods(methods);
  if (currencies.length === 0) return usable;
  return usable.filter((m) => currencies.some((c) => paymentMethodAppliesTo(m, c)));
}

/** The label to show for a method: its own, or the kind fallback when blank. */
export function resolvePaymentLabel(
  method: PaymentMethod,
  kindLabels: Record<PaymentMethodKind, string>,
): string {
  const own = method.label.trim();
  return own !== '' ? own : kindLabels[method.kind];
}

/** One reminder line, e.g. "Pix (CPF): 123.456.789-00" — a currency-scoped
 *  method shows its currencies, e.g. "Pix (BRL): 123.456.789-00". */
export function paymentMethodLine(
  method: PaymentMethod,
  kindLabels: Record<PaymentMethodKind, string>,
): string {
  const scoped = method.currencies ?? [];
  const suffix = scoped.length > 0 ? ` (${scoped.join(', ')})` : '';
  return `${resolvePaymentLabel(method, kindLabels)}${suffix}: ${method.value.trim()}`;
}

/**
 * The payment block appended to a reminder, or null when there is nothing to
 * append (no enabled, non-empty methods) — so the caller leaves the message
 * exactly as it was before (zero regression for users with no methods set).
 */
export function buildPaymentInstructions(
  methods: PaymentMethod[],
  labels: PaymentInstructionLabels,
): string | null {
  const usable = enabledPaymentMethods(methods);
  if (usable.length === 0) return null;
  const lines = usable.map((m) => `• ${paymentMethodLine(m, labels.kindLabels)}`);
  return `${labels.header}\n${lines.join('\n')}`;
}

/**
 * DEC-476 — the payment block for a charge in ONE currency: only the methods
 * that can actually receive that currency are listed (a BRL charge never shows
 * a EUR-only IBAN). Falls back to null exactly like the unscoped builder.
 */
export function buildPaymentInstructionsForCurrency(
  methods: PaymentMethod[],
  currency: string,
  labels: PaymentInstructionLabels,
): string | null {
  return buildPaymentInstructions(paymentMethodsForCurrencies(methods, [currency]), labels);
}

// --- pure mutation helpers (the editor persists the returned array) ---

export function addPaymentMethod(
  methods: PaymentMethod[],
  kind: PaymentMethodKind,
  label: string,
  value: string,
): PaymentMethod[] {
  return [...methods, createPaymentMethod(kind, label, value)];
}

export function removePaymentMethod(methods: PaymentMethod[], id: string): PaymentMethod[] {
  return methods.filter((m) => m.id !== id);
}

export function togglePaymentMethod(methods: PaymentMethod[], id: string): PaymentMethod[] {
  return methods.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
}

export function updatePaymentMethod(
  methods: PaymentMethod[],
  id: string,
  fields: Partial<Pick<PaymentMethod, 'kind' | 'label' | 'value' | 'currencies'>>,
): PaymentMethod[] {
  return methods.map((m) =>
    m.id === id
      ? {
          ...m,
          ...(fields.kind !== undefined ? { kind: fields.kind } : {}),
          ...(fields.label !== undefined ? { label: fields.label } : {}),
          ...(fields.value !== undefined ? { value: fields.value } : {}),
          ...(fields.currencies !== undefined ? { currencies: fields.currencies } : {}),
        }
      : m,
  );
}

/**
 * DEC-476 — flip one currency on a method's scope. Adding the first currency
 * narrows the method from "all currencies" to just that one; removing the last
 * returns it to "all currencies" (empty scope).
 */
export function togglePaymentMethodCurrency(
  methods: PaymentMethod[],
  id: string,
  currency: string,
): PaymentMethod[] {
  return methods.map((m) => {
    if (m.id !== id) return m;
    const scoped = m.currencies ?? [];
    const next = scoped.includes(currency)
      ? scoped.filter((c) => c !== currency)
      : [...scoped, currency];
    return { ...m, currencies: next };
  });
}

/**
 * DEC-476 — the redacted, share-safe view of the owner's payment methods that
 * rides a charge payload (link / live statement): kind + label + value +
 * currency scope only. No ids, no disabled entries — the guest sees exactly
 * what the reminder message would print.
 */
export interface SharedPaymentMethod {
  kind: PaymentMethodKind;
  label: string;
  value: string;
  currencies?: string[];
}

export function toSharedPaymentMethods(methods: PaymentMethod[]): SharedPaymentMethod[] {
  return enabledPaymentMethods(methods).map((m) => ({
    kind: m.kind,
    label: m.label,
    value: m.value.trim(),
    ...((m.currencies ?? []).length > 0 ? { currencies: m.currencies } : {}),
  }));
}

/**
 * DEC-476 — the shared methods a guest should see for the currencies they owe.
 * Same semantics as {@link paymentMethodsForCurrencies}: unscoped methods match
 * everything; an empty `currencies` filter shows all.
 */
export function sharedPaymentMethodsForCurrencies(
  methods: SharedPaymentMethod[],
  currencies: string[],
): SharedPaymentMethod[] {
  if (currencies.length === 0) return methods;
  return methods.filter((m) => {
    const scoped = m.currencies ?? [];
    return scoped.length === 0 || currencies.some((c) => scoped.includes(c));
  });
}

export function movePaymentMethod(
  methods: PaymentMethod[],
  id: string,
  direction: 'up' | 'down',
): PaymentMethod[] {
  const index = methods.findIndex((m) => m.id === id);
  if (index < 0) return methods;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= methods.length) return methods;
  const next = [...methods];
  const moved = next[index];
  const displaced = next[target];
  if (moved === undefined || displaced === undefined) return methods;
  next[index] = displaced;
  next[target] = moved;
  return next;
}
