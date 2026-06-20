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

/** The label to show for a method: its own, or the kind fallback when blank. */
export function resolvePaymentLabel(
  method: PaymentMethod,
  kindLabels: Record<PaymentMethodKind, string>,
): string {
  const own = method.label.trim();
  return own !== '' ? own : kindLabels[method.kind];
}

/** One reminder line, e.g. "Pix (CPF): 123.456.789-00". */
export function paymentMethodLine(
  method: PaymentMethod,
  kindLabels: Record<PaymentMethodKind, string>,
): string {
  return `${resolvePaymentLabel(method, kindLabels)}: ${method.value.trim()}`;
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
  fields: Partial<Pick<PaymentMethod, 'kind' | 'label' | 'value'>>,
): PaymentMethod[] {
  return methods.map((m) =>
    m.id === id
      ? {
          ...m,
          ...(fields.kind !== undefined ? { kind: fields.kind } : {}),
          ...(fields.label !== undefined ? { label: fields.label } : {}),
          ...(fields.value !== undefined ? { value: fields.value } : {}),
        }
      : m,
  );
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
