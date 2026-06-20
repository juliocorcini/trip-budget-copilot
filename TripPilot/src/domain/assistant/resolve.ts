import { toCents } from '@/domain/money';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { WalletType } from '@/domain/types/common';

/**
 * AI Quick Entry (DEC-246) — pure, on-device resolution of the model's
 * by-name entities into concrete app values. No network, no db, no randomness:
 * every function is a deterministic mapping so the planner can stay testable and
 * the cloud never sees ids, amounts or history.
 */

/** The QuickAdd category taxonomy (kept in sync with QuickAddPage). */
export const EXPENSE_CATEGORY_KEYS = [
  'bar',
  'restaurant',
  'market',
  'transport',
  'outing',
  'entertainment',
  'health',
  'accommodation',
  'other',
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORY_KEYS)[number];

/** Lowercase + strip accents so matching is locale-tolerant ("café" → "cafe"). */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const CATEGORY_SYNONYMS: { key: ExpenseCategoryKey; terms: string[] }[] = [
  {
    key: 'bar',
    terms: ['bar', 'cerveja', 'beer', 'drink', 'drinks', 'chopp', 'pub', 'bebida', 'cocktail', 'caipirinha', 'vinho', 'wine', 'shot', 'cerveza'],
  },
  {
    key: 'restaurant',
    terms: ['restaurante', 'restaurant', 'restaurante', 'almoco', 'jantar', 'lunch', 'dinner', 'comida', 'food', 'lanche', 'cafe', 'coffee', 'padaria', 'pizza', 'burger', 'hamburguer', 'sushi', 'cena', 'comer'],
  },
  {
    key: 'market',
    terms: ['mercado', 'market', 'supermercado', 'supermarket', 'grocery', 'groceries', 'feira', 'compras', 'agua', 'snack'],
  },
  {
    key: 'transport',
    terms: ['transporte', 'transport', 'uber', 'taxi', 'cabify', 'bolt', 'onibus', 'bus', 'metro', 'trem', 'train', 'gasolina', 'fuel', 'combustivel', 'passagem', 'flight', 'voo', 'aviao', 'tram', 'bilhete'],
  },
  {
    key: 'outing',
    terms: ['saida', 'outing', 'role', 'passeio', 'balada', 'festa', 'party', 'noite', 'night out'],
  },
  {
    key: 'entertainment',
    terms: ['entretenimento', 'entertainment', 'cinema', 'show', 'ingresso', 'ticket', 'jogo', 'game', 'museu', 'museum', 'parque', 'teatro', 'concert', 'concerto'],
  },
  {
    key: 'health',
    terms: ['saude', 'health', 'farmacia', 'pharmacy', 'remedio', 'medico', 'doctor', 'hospital', 'dentista', 'salud'],
  },
  {
    key: 'accommodation',
    terms: ['hospedagem', 'accommodation', 'hotel', 'hostel', 'airbnb', 'pousada', 'quarto', 'room', 'stay', 'alojamiento', 'diaria'],
  },
];

/** Snaps a free label to a taxonomy key; defaults to `other`. */
export function resolveCategory(label: string | null | undefined): ExpenseCategoryKey {
  if (!label) return 'other';
  const normalized = normalizeText(label);
  if ((EXPENSE_CATEGORY_KEYS as readonly string[]).includes(normalized)) {
    return normalized as ExpenseCategoryKey;
  }
  for (const { key, terms } of CATEGORY_SYNONYMS) {
    if (terms.some((term) => normalized.includes(normalizeText(term)))) return key;
  }
  return 'other';
}

export interface ResolvedAmount {
  amountCents: number;
  currency: string;
}

/** Converts a major-unit amount + optional currency into cents + a currency. */
export function resolveAmount(
  amount: number | null,
  currency: string | null,
  baseCurrency: string,
): ResolvedAmount | null {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;
  return { amountCents: toCents(amount), currency: currency ?? baseCurrency };
}

export type PersonMatch =
  | { status: 'matched'; participant: Participant }
  | { status: 'none' }
  | { status: 'ambiguous'; candidates: Participant[] };

const SELF_TERMS = ['me', 'eu', 'mim', 'myself', 'i', 'yo'];

/**
 * Resolves a spoken name to a participant. "me"/"eu" → the owner. Prefers exact
 * name/nickname matches; falls back to prefix/substring. 0 → none, 1 → matched,
 * 2+ → ambiguous (the UI asks "which one?").
 */
export function resolvePerson(
  name: string | null | undefined,
  participants: Participant[],
  owner: Participant | null,
): PersonMatch {
  if (!name) return { status: 'none' };
  const needle = normalizeText(name);
  if (needle === '') return { status: 'none' };
  if (owner && SELF_TERMS.includes(needle)) return { status: 'matched', participant: owner };

  const nameOf = (p: Participant) => normalizeText(p.name);
  const nickOf = (p: Participant) => (p.nickname ? normalizeText(p.nickname) : '');

  const exact = participants.filter((p) => nameOf(p) === needle || nickOf(p) === needle);
  if (exact.length === 1) return { status: 'matched', participant: exact[0]! };
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact };

  const loose = participants.filter((p) => {
    const n = nameOf(p);
    const nick = nickOf(p);
    return n.startsWith(needle) || n.includes(needle) || (nick !== '' && (nick.startsWith(needle) || nick.includes(needle)));
  });
  if (loose.length === 0) return { status: 'none' };
  if (loose.length === 1) return { status: 'matched', participant: loose[0]! };
  return { status: 'ambiguous', candidates: loose };
}

export type WalletMatch =
  | { status: 'matched'; wallet: Wallet }
  | { status: 'none' }
  | { status: 'ambiguous'; candidates: Wallet[] };

// Maps spoken hints to the app's real WalletType union ('debit_card',
// 'credit_card', 'cash', 'digital', 'other'). "banco/conta/wise" lean digital or
// debit; "cartão" stays broad until a clearer word ("crédito") narrows it.
const WALLET_TYPE_HINTS: { types: WalletType[]; terms: string[] }[] = [
  { types: ['cash'], terms: ['dinheiro', 'cash', 'especie', 'grana', 'nota', 'efectivo'] },
  { types: ['credit_card'], terms: ['credito', 'credit', 'tarjeta de credito'] },
  { types: ['debit_card'], terms: ['debito', 'debit'] },
  { types: ['digital', 'debit_card'], terms: ['banco', 'bank', 'conta', 'wise', 'revolut', 'nubank', 'cuenta', 'pix', 'digital'] },
  { types: ['credit_card', 'debit_card', 'digital'], terms: ['cartao', 'card', 'tarjeta', 'visa', 'master'] },
];

/** Resolves a wallet by name first, then by a type hint ("dinheiro" → cash). */
export function resolveWallet(label: string | null | undefined, wallets: Wallet[]): WalletMatch {
  if (!label) return { status: 'none' };
  const needle = normalizeText(label);
  if (needle === '') return { status: 'none' };

  const byName = wallets.filter((w) => {
    const wn = normalizeText(w.name);
    return wn === needle || wn.includes(needle) || needle.includes(wn);
  });
  if (byName.length === 1) return { status: 'matched', wallet: byName[0]! };
  if (byName.length > 1) return { status: 'ambiguous', candidates: byName };

  for (const hint of WALLET_TYPE_HINTS) {
    if (hint.terms.some((term) => needle.includes(normalizeText(term)))) {
      const byType = wallets.filter((w) => hint.types.includes(w.walletType));
      if (byType.length === 1) return { status: 'matched', wallet: byType[0]! };
      if (byType.length > 1) return { status: 'ambiguous', candidates: byType };
    }
  }
  return { status: 'none' };
}

const DAY_MS = 86_400_000;

/**
 * Normalizes a date phrase to an ISO timestamp. "hoje"/"now" → undefined (the
 * factories default to now); "ontem"/"yesterday" → −1 day; ISO passes through.
 */
export function resolveDate(raw: string | null | undefined, now: Date): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  const normalized = normalizeText(raw);
  if (['hoje', 'today', 'agora', 'now', 'hoy'].includes(normalized)) return undefined;
  if (['ontem', 'yesterday', 'ayer'].includes(normalized)) return new Date(now.getTime() - DAY_MS).toISOString();
  if (['anteontem'].includes(normalized)) return new Date(now.getTime() - 2 * DAY_MS).toISOString();
  return undefined;
}
