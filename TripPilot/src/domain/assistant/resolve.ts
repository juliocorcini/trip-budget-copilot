import { toCents } from '@/domain/money';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { WalletType, CurrentPlace } from '@/domain/types/common';

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

/** A place candidate (the sticky place or one derived from history) the resolver
 * can snap a spoken venue name onto, recovering its coordinates/provider id. */
export interface KnownPlace {
  label: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
}

/**
 * Resolves a spoken place into the expense's place (DEC-246 parity — a manual
 * entry can name where it happened, so the AI must not drop it). When the model
 * named a venue, snap it to a KNOWN place (the current sticky one or one reused
 * from history) so its coordinates/id come back — this powers "spend by place"
 * and offline re-tagging exactly like QuickAdd. An unknown venue becomes a
 * label-only place (the user said it; coordinates can be added later). With no
 * named place, the current sticky place is kept (the prior behavior).
 */
export function resolvePlace(
  label: string | null | undefined,
  known: KnownPlace[],
  sticky: CurrentPlace | null,
): CurrentPlace | null {
  if (!label) return sticky;
  const needle = normalizeText(label);
  if (needle === '') return sticky;

  const candidates: KnownPlace[] = sticky ? [sticky, ...known] : known;
  const match = candidates.find((p) => {
    const n = normalizeText(p.label);
    return n !== '' && (n === needle || n.includes(needle) || needle.includes(n));
  });
  if (match) return { label: match.label, lat: match.lat, lng: match.lng, placeId: match.placeId };

  return { label: label.trim(), lat: null, lng: null, placeId: null };
}

const DAY_MS = 86_400_000;

const TODAY_TERMS = ['hoje', 'today', 'agora', 'now', 'hoy'];
const YESTERDAY_TERMS = ['ontem', 'yesterday', 'ayer'];
const TWO_DAYS_TERMS = ['anteontem', 'antes de ontem', 'anteayer'];
const LAST_WEEK_TERMS = ['semana passada', 'last week', 'semana pasada'];

/** "3 dias atrás", "2 days ago", "hace 4 días" → the number of days back. */
const DAYS_AGO_RE = /(\d{1,3})\s*(?:dias?|days?|d[ií]as?)\s*(?:atras|atrás|ago|antes)/;
const AGO_DAYS_RE = /(?:hace|fa)\s*(\d{1,3})\s*(?:dias?|d[ií]as?|days?)/;

/**
 * Normalizes a date phrase to an ISO timestamp the factories accept. "hoje"/"now"
 * → undefined (factory defaults to now); ISO (date or full datetime) passes
 * through; otherwise relative phrases resolve against `now`: "ontem" −1d,
 * "anteontem" −2d, "semana passada" −7d, and "N dias atrás"/"N days ago"/"hace N
 * días" −Nd. Anything unrecognized → undefined (defaults to now). Maximizes the
 * date info the AI keeps without ever guessing a wrong day.
 */
export function resolveDate(raw: string | null | undefined, now: Date): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  const normalized = normalizeText(raw);
  if (TODAY_TERMS.includes(normalized)) return undefined;
  if (YESTERDAY_TERMS.includes(normalized)) return daysBack(now, 1);
  if (TWO_DAYS_TERMS.includes(normalized)) return daysBack(now, 2);
  if (LAST_WEEK_TERMS.includes(normalized)) return daysBack(now, 7);

  const daysAgo = normalized.match(DAYS_AGO_RE) ?? normalized.match(AGO_DAYS_RE);
  if (daysAgo) {
    const n = Number(daysAgo[1]);
    if (Number.isFinite(n) && n > 0 && n <= 366) return daysBack(now, n);
  }
  return undefined;
}

function daysBack(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}
