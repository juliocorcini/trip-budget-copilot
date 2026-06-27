/**
 * DEC-371 (wave 2026-06-27, G1 spec) — the canonical 15-state model for a P2P
 * division / charge / payment, as a pure, data-driven state machine.
 *
 * Scope: the person-to-person settle flows mapped in
 * `brain/documents/2026-06-27-settle-flows-map.md` (flows A–G). It is metadata
 * OVER the existing debt engine — the settlement arithmetic is untouched (a debt
 * folds nothing before acceptance, a payment settles only on confirm). It is
 * ADDITIVE over the DEC-353 `GroupPaymentStatus` (a 5-value subset) — see
 * {@link settleStateFromGroupPayment}.
 *
 * Pure: zero React, zero IO, zero i18n. The UI (G6) maps the tone to colour
 * tokens and the label key to `t()`. This module ships in G1 as types + tests
 * only and is NOT yet wired into any surface (application is G6).
 *
 * Two viewpoints model every flow: the `creator` (who initiated the division /
 * charge — by convention the creditor) and the `receiver` (the counterparty —
 * by convention the debtor). The "I paid you" repayment flow (E) inverts those
 * roles at the orchestrator layer; this state machine keeps the canonical
 * creator=creditor convention and the orchestrator remaps direction.
 */

import type { GroupPaymentStatus } from '@/domain/group-split/types';

/** The 15 canonical states (DEC-371). Code identifiers are English; the pt/en/es
 *  labels resolve from {@link settleStateLabelKey}. */
export type SettleState =
  | 'draft' //                 rascunho — being composed, not real yet
  | 'created' //               criada — ready to send
  | 'sending' //               enviando — in flight to the peer mailbox
  | 'sent' //                  enviada — left this device, awaiting the peer's drain
  | 'received' //              recebida — arrived in the receiver's app
  | 'awaiting_acceptance' //   aguardando aceite — surfaced, awaiting the receiver's decision
  | 'accepted' //              aceita — the receiver agreed the debt exists
  | 'rejected' //              rejeitada — the receiver disagreed the debt exists
  | 'awaiting_payment' //      aguardando pagamento — accepted, debtor still owes
  | 'marked_paid' //           marcada como paga — the debtor said "paguei"
  | 'awaiting_confirmation' // aguardando confirmação — awaiting the creditor's confirm
  | 'confirmed' //             confirmada — the creditor confirmed receipt (the ONLY closed state)
  | 'cancelled' //             cancelada — withdrawn by the creator
  | 'send_failed' //           erro de envio — delivery failed, retryable
  | 'expired'; //              expirada — timed out without acceptance/payment

/** Every state, in lifecycle order. The source of truth for "all 15 exist". */
export const SETTLE_STATES: readonly SettleState[] = [
  'draft',
  'created',
  'sending',
  'sent',
  'received',
  'awaiting_acceptance',
  'accepted',
  'rejected',
  'awaiting_payment',
  'marked_paid',
  'awaiting_confirmation',
  'confirmed',
  'cancelled',
  'send_failed',
  'expired',
];

/** A display tone — the UI maps each to a colour token. `muted` is the grey of a
 *  voided/withdrawn state; the other four mirror {@link GroupPaymentTone}. */
export type SettleTone = 'positive' | 'neutral' | 'pending' | 'danger' | 'muted';

/** The two viewpoints of every flow. */
export type SettleRole = 'creator' | 'receiver';

/** The per-state metadata, data-driven (no branching logic). */
export interface SettleStateMeta {
  /** Display tone. FAIRNESS RULE: `marked_paid` / `awaiting_confirmation` are
   *  NEVER `danger` — a debtor who said "paguei" is not penalised while waiting. */
  tone: SettleTone;
  /** Only `confirmed` closes an obligation (mirrors {@link isGroupObligationClosed}). */
  closesObligation: boolean;
  /** No forward progress is expected here (still reversible per Â9 — every closed
   *  state can be walked back). */
  terminal: boolean;
  /** In the delivery phase (sending / sent / received) — not yet acted on. */
  inFlight: boolean;
  /** Whether a debtor reads as "owing / deve" here. `marked_paid` and
   *  `awaiting_confirmation` are `false` — they must NEVER render as "deve". */
  showsAsOwing: boolean;
  /** Which role must act next to advance the flow (canonical creator=creditor
   *  convention), or null when the system / nobody acts. */
  actionableBy: SettleRole | null;
  /** Which side gets a notification when this state is entered, or null. */
  notifies: SettleRole | null;
}

/**
 * The single source of per-state behaviour. Everything else derives from this
 * (data-driven over branching — software-engineering-guidelines §3.5).
 */
export const SETTLE_STATE_META: Record<SettleState, SettleStateMeta> = {
  draft: {
    tone: 'muted',
    closesObligation: false,
    terminal: false,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: 'creator',
    notifies: null,
  },
  created: {
    tone: 'pending',
    closesObligation: false,
    terminal: false,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: 'creator',
    notifies: null,
  },
  sending: {
    tone: 'pending',
    closesObligation: false,
    terminal: false,
    inFlight: true,
    showsAsOwing: false,
    actionableBy: null,
    notifies: null,
  },
  sent: {
    tone: 'pending',
    closesObligation: false,
    terminal: false,
    inFlight: true,
    showsAsOwing: false,
    actionableBy: null,
    notifies: null,
  },
  received: {
    tone: 'pending',
    closesObligation: false,
    terminal: false,
    inFlight: true,
    showsAsOwing: false,
    actionableBy: 'receiver',
    notifies: 'receiver',
  },
  awaiting_acceptance: {
    tone: 'pending',
    closesObligation: false,
    terminal: false,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: 'receiver',
    notifies: null,
  },
  accepted: {
    tone: 'neutral',
    closesObligation: false,
    terminal: false,
    inFlight: false,
    showsAsOwing: true,
    actionableBy: 'receiver',
    notifies: 'creator',
  },
  rejected: {
    tone: 'danger',
    closesObligation: false,
    terminal: true,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: 'creator',
    notifies: 'creator',
  },
  awaiting_payment: {
    tone: 'pending',
    closesObligation: false,
    terminal: false,
    inFlight: false,
    showsAsOwing: true,
    actionableBy: 'receiver',
    notifies: null,
  },
  marked_paid: {
    // FAIRNESS: neutral, never danger; never reads as "deve".
    tone: 'neutral',
    closesObligation: false,
    terminal: false,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: 'creator',
    notifies: 'creator',
  },
  awaiting_confirmation: {
    // FAIRNESS: neutral, never danger; never reads as "deve".
    tone: 'neutral',
    closesObligation: false,
    terminal: false,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: 'creator',
    notifies: null,
  },
  confirmed: {
    tone: 'positive',
    closesObligation: true,
    terminal: true,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: null,
    notifies: 'receiver',
  },
  cancelled: {
    tone: 'muted',
    closesObligation: false,
    terminal: true,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: null,
    notifies: 'receiver',
  },
  send_failed: {
    tone: 'danger',
    closesObligation: false,
    terminal: false,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: 'creator',
    notifies: 'creator',
  },
  expired: {
    tone: 'muted',
    closesObligation: false,
    terminal: true,
    inFlight: false,
    showsAsOwing: false,
    actionableBy: 'creator',
    notifies: 'creator',
  },
};

/**
 * Allowed transitions per state (data-driven). Â9: nothing is irreversible —
 * every closed/terminal state can be walked back, so a mistap is recoverable.
 */
export const SETTLE_STATE_TRANSITIONS: Record<SettleState, readonly SettleState[]> = {
  draft: ['created', 'cancelled'],
  created: ['sending', 'cancelled'],
  sending: ['sent', 'send_failed'],
  send_failed: ['sending', 'cancelled'],
  sent: ['received', 'expired', 'cancelled'],
  received: ['awaiting_acceptance', 'accepted', 'rejected', 'expired'],
  awaiting_acceptance: ['accepted', 'rejected', 'expired', 'cancelled'],
  accepted: ['awaiting_payment', 'confirmed', 'cancelled'],
  rejected: ['awaiting_acceptance', 'cancelled'],
  awaiting_payment: ['marked_paid', 'confirmed', 'cancelled'],
  marked_paid: ['awaiting_confirmation', 'confirmed', 'awaiting_payment'],
  awaiting_confirmation: ['confirmed', 'awaiting_payment'],
  confirmed: ['awaiting_payment'],
  cancelled: ['created'],
  expired: ['created', 'sending'],
};

/** True when `to` is a legal next state from `from` (used to gate UI actions). */
export function canTransitionSettleState(from: SettleState, to: SettleState): boolean {
  if (from === to) return false;
  return SETTLE_STATE_TRANSITIONS[from].includes(to);
}

/** The display tone for a state. */
export function settleStateTone(state: SettleState): SettleTone {
  return SETTLE_STATE_META[state].tone;
}

/**
 * The ONLY state that closes an obligation. A `marked_paid` /
 * `awaiting_confirmation` is awaiting the creditor and never counts as settled.
 */
export function isSettleObligationClosed(state: SettleState): boolean {
  return SETTLE_STATE_META[state].closesObligation;
}

/** No forward progress expected (still reversible per Â9). */
export function isSettleTerminal(state: SettleState): boolean {
  return SETTLE_STATE_META[state].terminal;
}

/** True during the delivery phase (sending / sent / received). */
export function isSettleInFlight(state: SettleState): boolean {
  return SETTLE_STATE_META[state].inFlight;
}

/**
 * Whether a debtor reads as "owing / deve" in this state. THE FAIRNESS RULE:
 * `marked_paid` and `awaiting_confirmation` return `false` — a payer who said
 * "paguei" must never be shown as still owing while awaiting confirmation.
 */
export function settleShowsAsOwing(state: SettleState): boolean {
  return SETTLE_STATE_META[state].showsAsOwing;
}

/** Which role must act next to advance the flow (or null). */
export function settleActionableBy(state: SettleState): SettleRole | null {
  return SETTLE_STATE_META[state].actionableBy;
}

/** Whether the given role is the one expected to act next in this state. */
export function isSettleActionableBy(state: SettleState, role: SettleRole): boolean {
  return SETTLE_STATE_META[state].actionableBy === role;
}

/** Which side gets a notification when this state is entered (or null). */
export function settleNotifies(state: SettleState): SettleRole | null {
  return SETTLE_STATE_META[state].notifies;
}

/** The i18n key for a state label (single source for chips/timeline/detail). */
export function settleStateLabelKey(state: SettleState): string {
  return `settle_state.${state}`;
}

/** The full per-state descriptor, for the UI to render a state in one read. */
export function describeSettleState(state: SettleState): SettleStateMeta & {
  state: SettleState;
  labelKey: string;
} {
  return { state, labelKey: settleStateLabelKey(state), ...SETTLE_STATE_META[state] };
}

/**
 * Bridge — render the DEC-353 group payment 5-state within the unified 15-state
 * vocabulary. Lossy by design (the group model has no delivery/acceptance
 * phase): `contested` maps to `awaiting_payment` (the debtor still owes after a
 * bounced "paguei" claim — the contested-specific danger tone is a group-only
 * nuance). Used in G6 so the group + P2P surfaces speak one state language.
 */
export function settleStateFromGroupPayment(status: GroupPaymentStatus): SettleState {
  switch (status) {
    case 'unpaid':
      return 'awaiting_payment';
    case 'marked':
      return 'marked_paid';
    case 'confirmed':
      return 'confirmed';
    case 'contested':
      return 'awaiting_payment';
    case 'cancelled':
      return 'cancelled';
  }
}

/** The inbound P2P kinds that carry a settle obligation (a `group_invite` does not). */
export type InboundSettleKind = 'debt' | 'payment';

/**
 * DEC-371 (G6) — map an inbound P2P item, from MY (the recipient's) viewpoint, to
 * the 15-state vocabulary so the inbox + detail render one state language:
 *  - an inbound `debt` ("you owe me X") is awaiting MY acceptance ⇒ `awaiting_acceptance`;
 *  - an inbound `payment` ("I paid you" / "you paid me") is awaiting MY confirmation
 *    of receipt ⇒ `awaiting_confirmation` (FAIRNESS: never reads as "owing").
 * Pure + total over the obligation kinds (a `group_invite` is not a settle state).
 */
export function settleStateFromInboundKind(kind: InboundSettleKind): SettleState {
  return kind === 'debt' ? 'awaiting_acceptance' : 'awaiting_confirmation';
}
