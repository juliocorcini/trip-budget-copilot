/**
 * DEC-353 (G7) — the group-split payment lifecycle as a pure, data-driven state
 * machine. The fairness rule Julio asked for lives here: a payer who marked paid
 * is **never penalised** for the receiver's inaction (`marked` is neutral, never
 * red), and **only the receiver** (or a logged organizer override) closes an
 * obligation (`confirmed`). The settlement arithmetic is untouched — these states
 * are metadata over the same debt engine (see `computeGroupBalances`).
 *
 * Pure: zero React, zero IO. The UI maps the tone to colour tokens + the label
 * key to `t()`.
 */
import type { GroupPaymentStatus } from './types';

/** A display tone — the "never penalise marked-paid" rule encoded once. */
export type GroupPaymentTone = 'positive' | 'neutral' | 'pending' | 'danger';

/**
 * Allowed transitions per state (data-driven, not branching logic). Â9: nothing
 * is irreversible — every closed/marked state can be walked back, so a mistap is
 * always recoverable.
 */
export const GROUP_PAYMENT_TRANSITIONS: Record<GroupPaymentStatus, readonly GroupPaymentStatus[]> = {
  // Owes, no action yet. The debtor can mark; the owner can confirm a cash/in-person settle.
  unpaid: ['marked', 'confirmed'],
  // Marked-paid · awaiting confirmation. The receiver confirms, contests, or it is withdrawn.
  marked: ['confirmed', 'contested', 'cancelled', 'unpaid'],
  // Closed. Revertible (mistap / dispute reopened).
  confirmed: ['unpaid', 'contested'],
  // Receiver rejected a false "paguei" — debtor re-marks, or it resets/resolves.
  contested: ['marked', 'unpaid', 'confirmed'],
  // The mark was withdrawn — back to owing.
  cancelled: ['unpaid', 'marked'],
};

/** True when `to` is a legal next state from `from` (used to gate UI actions). */
export function canTransitionGroupPayment(from: GroupPaymentStatus, to: GroupPaymentStatus): boolean {
  if (from === to) return false;
  return GROUP_PAYMENT_TRANSITIONS[from].includes(to);
}

/**
 * The ONLY state that closes an obligation. Used by the settle/close signal so a
 * `marked` (awaiting) payment never counts as settled and the payer is never
 * shown as delinquent while waiting.
 */
export function isGroupObligationClosed(status: GroupPaymentStatus): boolean {
  return status === 'confirmed';
}

/**
 * The display tone for a debtor's payment chip. THE FAIRNESS RULE: `marked` is
 * `neutral` (never `danger`) — a payer who said "paguei" is not penalised while
 * the receiver hasn't confirmed. Only a genuine open debt (`unpaid`) or a
 * rejected claim (`contested`) reads as needing action; `cancelled` is back to
 * pending.
 */
export function groupPaymentTone(status: GroupPaymentStatus): GroupPaymentTone {
  switch (status) {
    case 'confirmed':
      return 'positive';
    case 'marked':
      return 'neutral';
    case 'contested':
      return 'danger';
    case 'cancelled':
    case 'unpaid':
    default:
      return 'pending';
  }
}

/**
 * Whether a debtor row still needs the user's attention. `marked` is awaiting the
 * OTHER side, so it is not "yours to act on"; `confirmed` is done. `unpaid`,
 * `contested`, `cancelled` still need movement.
 */
export function isGroupPaymentActionable(status: GroupPaymentStatus): boolean {
  return status === 'unpaid' || status === 'contested' || status === 'cancelled';
}

/** The i18n key for a status label (single source for chips/timeline/who-paid). */
export function groupPaymentStatusLabelKey(status: GroupPaymentStatus): string {
  return `group_split.pay_status_${status}`;
}
