import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { CurrentPlace } from '@/domain/types/common';
import type { AiIntent, AiDirection, AiScreen } from './intent';
import {
  normalizeText,
  resolveAmount,
  resolveCategory,
  resolveDate,
  resolvePerson,
  resolveWallet,
  type ExpenseCategoryKey,
  type PersonMatch,
} from './resolve';

/**
 * AI Quick Entry (DEC-246) — the PURE planner. Given a typed `AiIntent` and an
 * on-device `PlanContext` (ids already loaded), it produces ONE of:
 *  - `ready`  → an `ActionPlan` (an `execute` op for the engines, or a
 *               `navigate` target) plus a structured `preview` the sheet renders;
 *  - `needs`  → clarifications (missing amount, unknown/ambiguous person/wallet);
 *  - `unsupported` → a stable key the UI maps to a graceful manual fallback.
 *
 * It performs NO i/o and NO entity creation (`createSyncMetadata` is impure):
 * concrete entities are built in `dispatch.ts`. This keeps every routing rule
 * deterministic and unit-testable.
 */

/** A fully-resolved operation consumed by `dispatch.executeOp`. */
export type ExecOp =
  | {
      kind: 'expense';
      tripId: string;
      phaseId: string;
      budgetPoolId: string;
      walletId: string | null;
      amountCents: number;
      currency: string;
      category: ExpenseCategoryKey;
      description: string;
      date?: string;
      place: CurrentPlace | null;
      ownerId: string;
      /** Who handed over the money (owner id, or another participant). */
      payerId: string;
      didSplit: boolean;
      /** Split participants (for `i_paid_for` this is the single counterpart). */
      participantIds: string[];
      connectedParticipantIds: string[];
    }
  | {
      kind: 'income';
      tripId: string;
      phaseId: string;
      budgetPoolId: string;
      walletId: string | null;
      amountCents: number;
      currency: string;
      description: string;
    }
  | {
      kind: 'transfer' | 'withdraw';
      tripId: string;
      phaseId: string;
      sourceWalletId: string;
      targetWalletId: string;
      amountCents: number;
      currency: string;
      description: string;
    }
  | {
      kind: 'settle';
      tripId: string;
      currency: string;
      personId: string;
      direction: AiDirection;
      /** null = settle the full current debt (dispatch computes it). */
      amountCents: number | null;
    }
  | {
      kind: 'plan_purchase';
      tripId: string;
      budgetPoolId: string;
      phaseId: string | null;
      name: string;
      category: ExpenseCategoryKey;
      estimatedCostCents: number;
    };

/** Structured preview — the sheet localizes it (`assistant.preview.*`). */
export interface AssistantPreview {
  op: ExecOp['kind'] | 'navigate';
  amountCents?: number;
  currency?: string;
  personName?: string;
  participantNames?: string[];
  perPersonCents?: number;
  categoryKey?: string;
  description?: string;
  placeLabel?: string | null;
  debtDirection?: AiDirection;
  walletFromName?: string;
  walletToName?: string;
  itemName?: string;
  /** For `navigate` previews: a label key under `assistant.nav.*`. */
  navKey?: string;
}

export type Clarification =
  | { type: 'amount' }
  | { type: 'add_person'; name: string }
  | { type: 'choose_person'; name: string; candidates: ClarifyCandidate[] };

export interface ClarifyCandidate {
  id: string;
  label: string;
}

export type ActionPlan =
  | { type: 'execute'; op: ExecOp; preview: AssistantPreview }
  | { type: 'navigate'; to: string; preview: AssistantPreview };

export type PlanResult =
  | { status: 'ready'; plan: ActionPlan }
  | { status: 'needs'; clarifications: Clarification[]; note: string | null }
  | { status: 'unsupported'; messageKey: string };

export interface PlanContext {
  tripId: string;
  baseCurrency: string;
  phaseId: string | null;
  owner: Participant | null;
  participants: Participant[];
  connectedParticipantIds: string[];
  wallets: Wallet[];
  defaultPoolId: string | null;
  defaultWalletId: string | null;
  defaultSourceWalletId: string | null;
  defaultTargetWalletId: string | null;
  place: CurrentPlace | null;
  now: Date;
  /** Clarification answers: normalized requested name → chosen participant id.
   * Consulted before fuzzy matching so re-planning after a "which one?" tap
   * (or a freshly added person) resolves deterministically. */
  personOverrides?: Record<string, string>;
}

const nameOf = (p: Participant): string => p.nickname ?? p.name;
const toCandidate = (p: Participant): ClarifyCandidate => ({ id: p.id, label: nameOf(p) });

/** Person resolution that honors clarification overrides first. */
function matchPerson(name: string | null | undefined, ctx: PlanContext): PersonMatch {
  if (name && ctx.personOverrides) {
    const chosenId = ctx.personOverrides[normalizeText(name)];
    if (chosenId) {
      const participant = ctx.participants.find((p) => p.id === chosenId);
      if (participant) return { status: 'matched', participant };
    }
  }
  return resolvePerson(name, ctx.participants, ctx.owner);
}

/** Bare pronouns/group words the model may leak into `participants`. They carry
 * no resolvable identity (the planner already maps "ele" → the named person), so
 * the device drops them instead of asking "who is 'ele'?". */
const PRONOUN_TERMS: ReadonlySet<string> = new Set([
  'ele', 'ela', 'eles', 'elas', 'he', 'she', 'they', 'them',
  'o cara', 'a galera', 'a gente', 'nos', 'todos', 'todo mundo', 'el', 'ellos', 'ellas',
]);

type SharersResult =
  | { status: 'ok'; participants: Participant[] }
  | { status: 'needs'; result: PlanResult };

/**
 * Resolves a list of by-name sharers into participants: skips the user themself
 * (self-terms resolve to the owner, who is excluded) and unresolvable pronouns,
 * dedupes, and drops any id in `exclude` (e.g. the owner or the payer). The first
 * unknown/ambiguous REAL name short-circuits into a clarification.
 */
function resolveSharers(
  names: string[],
  ctx: PlanContext,
  exclude: Set<string>,
  note: string | null = null,
): SharersResult {
  const out: Participant[] = [];
  for (const raw of names) {
    const n = normalizeText(raw);
    if (n === '' || PRONOUN_TERMS.has(n)) continue;
    const match = matchPerson(raw, ctx);
    if (match.status === 'none') {
      return { status: 'needs', result: needs([{ type: 'add_person', name: cleanName(raw) }], note) };
    }
    if (match.status === 'ambiguous') {
      return {
        status: 'needs',
        result: needs([{ type: 'choose_person', name: cleanName(raw), candidates: match.candidates.map(toCandidate) }], note),
      };
    }
    const p = match.participant;
    if (!exclude.has(p.id) && !out.some((x) => x.id === p.id)) out.push(p);
  }
  return { status: 'ok', participants: out };
}

function needs(clarifications: Clarification[], note: string | null = null): PlanResult {
  return { status: 'needs', clarifications, note };
}

function unsupported(messageKey: string): PlanResult {
  return { status: 'unsupported', messageKey };
}

function navigate(to: string, navKey: string): PlanResult {
  return { status: 'ready', plan: { type: 'navigate', to, preview: { op: 'navigate', navKey } } };
}

const SCREEN_ROUTES: Record<AiScreen, string> = {
  debts: '/shared',
  expenses: '/expenses',
  dashboard: '/dashboard',
  wallets: '/wallets',
  planner: '/planner',
  income: '/income',
  trip: '/viagem',
};

export function buildActionPlan(intent: AiIntent, ctx: PlanContext): PlanResult {
  switch (intent.action) {
    case 'log_expense':
    case 'someone_paid':
    case 'i_paid_for':
    case 'split_expense':
      return planExpense(intent, ctx);
    case 'record_income':
      return planIncome(intent, ctx);
    case 'transfer':
    case 'withdraw':
      return planTransfer(intent, ctx);
    case 'settle_debt':
      return planSettle(intent, ctx);
    case 'plan_purchase':
      return planPurchase(intent, ctx);
    case 'open_split_bill':
      return navigate('/split/scan', 'split_bill');
    case 'open_scan_receipt':
      return navigate('/receipt/scan', 'scan_receipt');
    case 'open_outing':
      return navigate('/outings/new', 'outing');
    case 'open_plan_expense':
      return navigate('/viagem?plan=1', 'plan_expense');
    case 'open_simulator': {
      const suffix = intent.amount && intent.amount > 0 ? `?amount=${intent.amount}` : '';
      return navigate(`/simulator${suffix}`, 'simulator');
    }
    case 'open_screen': {
      const route = intent.screen ? SCREEN_ROUTES[intent.screen] : '/dashboard';
      return navigate(route, intent.screen ?? 'dashboard');
    }
    case 'unknown':
    default:
      return unsupported('unknown');
  }
}

function planExpense(intent: AiIntent, ctx: PlanContext): PlanResult {
  if (!ctx.owner) return unsupported('no_owner');
  if (!ctx.phaseId) return unsupported('no_phase');
  if (!ctx.defaultPoolId) return unsupported('no_pool');

  const amount = resolveAmount(intent.amount, intent.currency, ctx.baseCurrency);
  if (!amount) return needs([{ type: 'amount' }], intent.note);

  const category = resolveCategory(intent.category ?? intent.description);
  const description = (intent.description ?? '').trim();
  const date = resolveDate(intent.date, ctx.now);
  const owner = ctx.owner;

  const base = {
    kind: 'expense' as const,
    tripId: ctx.tripId,
    phaseId: ctx.phaseId,
    budgetPoolId: ctx.defaultPoolId,
    amountCents: amount.amountCents,
    currency: amount.currency,
    category,
    description,
    date,
    place: ctx.place,
    ownerId: owner.id,
    connectedParticipantIds: ctx.connectedParticipantIds,
  };

  const previewBase: AssistantPreview = {
    op: 'expense',
    amountCents: amount.amountCents,
    currency: amount.currency,
    categoryKey: category,
    description: description || undefined,
    placeLabel: ctx.place?.label ?? null,
  };

  // Equal-split builder shared by `split_expense` and the `someone_paid` reroute.
  // `payer` is the owner (I paid) or another participant (they paid); every entry
  // in `sharers` carries an equal part. `resolvePayerExpense` (DEC-114) turns this
  // into the right debts: each non-payer sharer owes the payer their slice.
  const equalSplit = (payer: Participant, sharers: Participant[]): PlanResult => {
    const participantIds = sharers.map((p) => p.id);
    const op: ExecOp = {
      ...base,
      walletId: payer.id === owner.id ? ctx.defaultWalletId : null,
      payerId: payer.id,
      didSplit: true,
      participantIds,
    };
    const preview: AssistantPreview = {
      ...previewBase,
      participantNames: sharers.map(nameOf),
      perPersonCents: Math.round(amount.amountCents / participantIds.length),
    };
    if (payer.id !== owner.id) {
      preview.personName = nameOf(payer);
      preview.debtDirection = 'i_owe';
    }
    return ready(op, preview);
  };

  // I paid, nobody else involved.
  if (intent.action === 'log_expense') {
    const op: ExecOp = {
      ...base,
      walletId: ctx.defaultWalletId,
      payerId: owner.id,
      didSplit: false,
      participantIds: [],
    };
    return ready(op, previewBase);
  }

  // Someone paid. Pure case (no other sharers) → I owe them the FULL amount
  // (DEC-114 row 4). But if the message also names other sharers, it is really a
  // split THEY paid (I owe only my slice) — reroute even when the model labeled
  // it `someone_paid`, so a misclassification can never overcharge the user.
  if (intent.action === 'someone_paid') {
    const match = matchPerson(intent.person, ctx);
    if (match.status === 'none') {
      return needs([{ type: 'add_person', name: cleanName(intent.person) }], intent.note);
    }
    if (match.status === 'ambiguous') {
      return needs([{ type: 'choose_person', name: cleanName(intent.person), candidates: match.candidates.map(toCandidate) }], intent.note);
    }
    const payer = match.participant;
    const others = resolveSharers(intent.participants, ctx, new Set([owner.id, payer.id]), intent.note);
    if (others.status === 'needs') return others.result;
    if (others.participants.length > 0) {
      return equalSplit(payer, [owner, payer, ...others.participants]);
    }
    const op: ExecOp = {
      ...base,
      walletId: null, // someone else's money moved, not mine
      payerId: payer.id,
      didSplit: false,
      participantIds: [],
    };
    return ready(op, { ...previewBase, op: 'expense', personName: nameOf(payer), debtDirection: 'i_owe' });
  }

  // I paid FOR others (I'm not a sharer). One person → they owe the full amount;
  // several → I covered the bill and they split it equally among themselves.
  if (intent.action === 'i_paid_for') {
    const names = intent.participants.length > 0 ? intent.participants : intent.person ? [intent.person] : [];
    const r = resolveSharers(names, ctx, new Set([owner.id]), intent.note);
    if (r.status === 'needs') return r.result;
    if (r.participants.length === 0) {
      return needs([{ type: 'add_person', name: cleanName(intent.person) }], intent.note);
    }
    const op: ExecOp = {
      ...base,
      walletId: ctx.defaultWalletId, // I paid from my wallet
      payerId: owner.id,
      didSplit: true,
      participantIds: r.participants.map((p) => p.id), // owner not a sharer → they owe it all
    };
    const preview: AssistantPreview = { ...previewBase, debtDirection: 'owes_me' };
    if (r.participants.length === 1) {
      preview.personName = nameOf(r.participants[0]!);
    } else {
      preview.participantNames = r.participants.map(nameOf);
      preview.perPersonCents = Math.round(amount.amountCents / r.participants.length);
    }
    return ready(op, preview);
  }

  // split_expense — divided equally (owner always shares). Payer is me unless one
  // is named (payer="other" → the named `person`, or the sole non-owner sharer).
  let payer = owner;
  if (intent.payer === 'other' && intent.person) {
    const payerMatch = matchPerson(intent.person, ctx);
    if (payerMatch.status === 'matched') payer = payerMatch.participant;
    else if (payerMatch.status === 'ambiguous') {
      return needs([{ type: 'choose_person', name: cleanName(intent.person), candidates: payerMatch.candidates.map(toCandidate) }], intent.note);
    }
  }

  const sharerNames = intent.participants.length > 0 ? intent.participants : intent.person ? [intent.person] : [];
  if (sharerNames.length === 0) {
    if (ctx.participants.length > 1) return equalSplit(owner, ctx.participants);
    return needs([{ type: 'add_person', name: '' }], intent.note);
  }

  const resolved = resolveSharers(sharerNames, ctx, new Set(), intent.note);
  if (resolved.status === 'needs') return resolved.result;
  const sharers: Participant[] = [owner];
  const pushUnique = (p: Participant): void => {
    if (!sharers.some((x) => x.id === p.id)) sharers.push(p);
  };
  if (payer.id !== owner.id) pushUnique(payer);
  for (const p of resolved.participants) pushUnique(p);

  // payer="other" with no explicit payer name: if exactly one non-owner shares,
  // they are the one who paid.
  if (intent.payer === 'other' && payer.id === owner.id) {
    const nonOwner = sharers.filter((p) => p.id !== owner.id);
    if (nonOwner.length === 1) payer = nonOwner[0]!;
  }

  if (sharers.length < 2) {
    if (ctx.participants.length > 1) return equalSplit(owner, ctx.participants);
    return needs([{ type: 'add_person', name: '' }], intent.note);
  }
  return equalSplit(payer, sharers);
}

function planIncome(intent: AiIntent, ctx: PlanContext): PlanResult {
  if (!ctx.phaseId) return unsupported('no_phase');
  if (!ctx.defaultPoolId) return unsupported('no_pool');
  const amount = resolveAmount(intent.amount, intent.currency, ctx.baseCurrency);
  if (!amount) return needs([{ type: 'amount' }], intent.note);
  const description = (intent.description ?? '').trim();
  const op: ExecOp = {
    kind: 'income',
    tripId: ctx.tripId,
    phaseId: ctx.phaseId,
    budgetPoolId: ctx.defaultPoolId,
    walletId: ctx.defaultWalletId,
    amountCents: amount.amountCents,
    currency: amount.currency,
    description,
  };
  return ready(op, {
    op: 'income',
    amountCents: amount.amountCents,
    currency: amount.currency,
    description: description || undefined,
  });
}

function planTransfer(intent: AiIntent, ctx: PlanContext): PlanResult {
  const kind = intent.action === 'withdraw' ? 'withdraw' : 'transfer';
  if (!ctx.phaseId) return unsupported('no_phase');
  const amount = resolveAmount(intent.amount, intent.currency, ctx.baseCurrency);
  if (!amount) return needs([{ type: 'amount' }], intent.note);

  const sourceId = resolveWalletId(intent.fromWallet, ctx.wallets) ?? ctx.defaultSourceWalletId;
  const targetId = resolveWalletId(intent.toWallet, ctx.wallets) ?? ctx.defaultTargetWalletId;

  // Need two distinct wallets to execute. Otherwise fall back to the manual
  // transfer screen with the amount prefilled (still faster than typing).
  if (!sourceId || !targetId || sourceId === targetId) {
    const type = kind === 'withdraw' ? 'withdrawal' : 'transfer';
    return navigate(`/quick-add?type=${type}&amount=${amount.amountCents / 100}`, kind);
  }

  const source = ctx.wallets.find((w) => w.id === sourceId);
  const target = ctx.wallets.find((w) => w.id === targetId);
  const op: ExecOp = {
    kind,
    tripId: ctx.tripId,
    phaseId: ctx.phaseId,
    sourceWalletId: sourceId,
    targetWalletId: targetId,
    amountCents: amount.amountCents,
    currency: amount.currency,
    description: (intent.description ?? '').trim(),
  };
  return ready(op, {
    op: kind,
    amountCents: amount.amountCents,
    currency: amount.currency,
    walletFromName: source?.name,
    walletToName: target?.name,
  });
}

function planSettle(intent: AiIntent, ctx: PlanContext): PlanResult {
  if (!ctx.owner) return unsupported('no_owner');
  const match = matchPerson(intent.person, ctx);
  if (match.status === 'none') return needs([{ type: 'add_person', name: cleanName(intent.person) }], intent.note);
  if (match.status === 'ambiguous') {
    return needs([{ type: 'choose_person', name: cleanName(intent.person), candidates: match.candidates.map(toCandidate) }], intent.note);
  }
  const person = match.participant;
  const direction: AiDirection = intent.direction ?? 'i_owe';
  const amount = resolveAmount(intent.amount, intent.currency, ctx.baseCurrency);
  const op: ExecOp = {
    kind: 'settle',
    tripId: ctx.tripId,
    currency: ctx.baseCurrency,
    personId: person.id,
    direction,
    amountCents: amount ? amount.amountCents : null,
  };
  return ready(op, {
    op: 'settle',
    personName: nameOf(person),
    debtDirection: direction,
    amountCents: amount?.amountCents,
    currency: ctx.baseCurrency,
  });
}

function planPurchase(intent: AiIntent, ctx: PlanContext): PlanResult {
  if (!ctx.defaultPoolId) return unsupported('no_pool');
  const amount = resolveAmount(intent.amount, intent.currency, ctx.baseCurrency);
  if (!amount) return needs([{ type: 'amount' }], intent.note);
  const name = (intent.itemName ?? intent.description ?? '').trim();
  if (name === '') return navigate('/viagem?plan=1', 'plan_expense');
  const category = resolveCategory(intent.category ?? intent.itemName);
  const op: ExecOp = {
    kind: 'plan_purchase',
    tripId: ctx.tripId,
    budgetPoolId: ctx.defaultPoolId,
    phaseId: ctx.phaseId,
    name,
    category,
    estimatedCostCents: amount.amountCents,
  };
  return ready(op, {
    op: 'plan_purchase',
    itemName: name,
    amountCents: amount.amountCents,
    currency: amount.currency,
    categoryKey: category,
  });
}

function ready(op: ExecOp, preview: AssistantPreview): PlanResult {
  return { status: 'ready', plan: { type: 'execute', op, preview } };
}

function cleanName(name: string | null | undefined): string {
  return (name ?? '').trim();
}

function resolveWalletId(label: string | null | undefined, wallets: Wallet[]): string | null {
  const match = resolveWallet(label, wallets);
  return match.status === 'matched' ? match.wallet.id : null;
}
